const { OpenAI } = require('openai');
const axios = require('axios');
require('dotenv').config();

// AI model configuration store
let modelConfigs = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo'
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    model: 'claude-3-opus-20240229'
  }
};

// Initialize OpenAI API client (will be updated when config changes)
let openai = new OpenAI({
  apiKey: modelConfigs.openai.apiKey
});

/**
 * Update AI model configuration
 * @param {string} provider - AI provider (openai or claude)
 * @param {Object} config - Configuration object with apiKey and model
 * @returns {boolean} Success status
 */
function updateModelConfig(provider, config) {
  try {
    if (!provider || !config) {
      throw new Error('Invalid configuration');
    }
    
    // Update the stored configuration
    modelConfigs[provider] = {
      ...modelConfigs[provider],
      ...config
    };
    
    // If it's OpenAI, reinitialize the client
    if (provider === 'openai') {
      openai = new OpenAI({
        apiKey: modelConfigs.openai.apiKey
      });
    }
    
    console.log(`Updated ${provider} configuration:`, {
      model: modelConfigs[provider].model,
      apiKey: modelConfigs[provider].apiKey ? '****' : 'Not set'
    });
    
    return true;
  } catch (error) {
    console.error('Error updating model configuration:', error);
    return false;
  }
}

/**
 * Get current AI model configurations
 * @returns {Object} Current model configurations (without API keys)
 */
function getModelConfigs() {
  // Return a copy without the API keys for security
  return {
    openai: {
      model: modelConfigs.openai.model,
      hasApiKey: !!modelConfigs.openai.apiKey
    },
    claude: {
      model: modelConfigs.claude.model,
      hasApiKey: !!modelConfigs.claude.apiKey
    }
  };
}

/**
 * Generate SQL from natural language query using the specified model
 * @param {string} naturalLanguageQuery - User's natural language query
 * @param {Object} databaseSchema - Database schema information
 * @param {string} provider - AI provider to use (openai or claude)
 * @returns {Promise<string>} Generated SQL query
 */
async function generateSqlQuery(naturalLanguageQuery, databaseSchema, provider = 'openai') {
  try {
    console.log(`Using ${provider} to generate SQL`);
    console.log('Database schema for AI:', JSON.stringify(databaseSchema, null, 2));
    
    if (!databaseSchema || Object.keys(databaseSchema).length === 0) {
      throw new Error('No database schema information available');
    }
    
    // Format the schema in a clearer, more structured way with key information
    const schemaContext = Object.entries(databaseSchema).map(([tableName, columns]) => {
      // Identify primary keys
      const primaryKeys = columns.filter(col => col.isPrimaryKey).map(col => col.name);
      
      // Identify foreign keys
      const foreignKeys = columns.filter(col => col.isForeignKey).map(col => col.name);
      
      // Format each column with its name, type, nullable status, and key information
      const columnDetails = columns.map(col => {
        const keyInfo = [];
        if (col.isPrimaryKey) keyInfo.push('PRIMARY KEY');
        if (col.isForeignKey) keyInfo.push('FOREIGN KEY');
        
        return `    - ${col.name} (Type: ${col.type}, ${col.nullable ? 'Nullable' : 'NOT NULL'}${keyInfo.length > 0 ? ', ' + keyInfo.join(', ') : ''})`;
      }).join('\n');
      
      // Add table summary with key information
      let tableInfo = `TABLE: ${tableName}\n`;
      if (primaryKeys.length > 0) {
        tableInfo += `PRIMARY KEY(S): ${primaryKeys.join(', ')}\n`;
      }
      if (foreignKeys.length > 0) {
        tableInfo += `FOREIGN KEY(S): ${foreignKeys.join(', ')}\n`;
      }
      tableInfo += `COLUMNS:\n${columnDetails}`;
      
      return tableInfo;
    }).join('\n\n');

    // Create prompt for the AI with explicit instructions about schema usage
    const prompt = `
You are a precise PostgreSQL expert who translates natural language queries into SQL.

POSTGRESQL DATABASE SCHEMA:
${schemaContext}

TASK: 
Convert this natural language query to PostgreSQL SQL:
"${naturalLanguageQuery}"

IMPORTANT GUIDELINES:
1. Use ONLY tables and columns that exist in the provided schema
2. Double check that EVERY column you reference actually exists in the specified tables
3. Use proper table and column names EXACTLY as shown in the schema (case-sensitive)
4. If a requested column doesn't exist, do not invent it - use columns that are available
5. Do not add "u.id" or other columns that aren't listed in the schema
6. Pay special attention to table names (they might be singular or plural)
7. If joining tables, ensure the join columns actually exist in both tables
8. Return ONLY the executable SQL query with no explanations or markdown

SQL QUERY:
`;

    // Log the prompt for debugging
    console.log('Prompt for AI:', prompt);

    let generatedSQL;
    
    // Use the selected provider
    if (provider === 'openai') {
      if (!modelConfigs.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: modelConfigs.openai.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Low temperature for more deterministic responses
        max_tokens: 1000
      });

      // Extract the SQL query
      generatedSQL = response.choices[0].message.content.trim();
    } 
    else if (provider === 'claude') {
      if (!modelConfigs.claude.apiKey) {
        throw new Error('Claude API key not configured');
      }
      
      // Call Claude API using axios
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: modelConfigs.claude.model,
          max_tokens: 1000,
          temperature: 0.1,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': modelConfigs.claude.apiKey
          }
        }
      );
      
      // Extract the SQL query
      generatedSQL = response.data.content[0].text.trim();
    }
    else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
    
    // Verify that the SQL only uses tables and columns that exist in the schema
    const sqlCheck = await validateGeneratedSQL(generatedSQL, databaseSchema);
    if (sqlCheck.hasIssues) {
      console.warn('Generated SQL may have issues:', sqlCheck.issues);
      // Could add additional code here to regenerate or fix the SQL
    }
    
    return generatedSQL;
  } catch (error) {
    console.error('Error generating SQL query:', error);
    throw error;
  }
}

/**
 * Basic validation of generated SQL against schema
 * @param {string} sql - The generated SQL query
 * @param {Object} schema - Database schema information
 * @returns {Object} Validation result
 */
async function validateGeneratedSQL(sql, schema) {
  const result = {
    hasIssues: false,
    issues: []
  };
  
  // Extract table aliases from the SQL (e.g., "FROM users u" gives {u: "users"})
  const tableAliases = {};
  const fromMatches = sql.match(/FROM\s+([a-zA-Z_"][a-zA-Z0-9_"]*)\s+(?:AS\s+)?([a-zA-Z][a-zA-Z0-9_]*)?/gi);
  if (fromMatches) {
    fromMatches.forEach(match => {
      const parts = match.split(/\s+/);
      if (parts.length >= 3) {
        const tableName = parts[1].replace(/"/g, '');
        const alias = parts[parts.indexOf('AS') + 1] || parts[2];
        if (alias && alias !== tableName) {
          tableAliases[alias] = tableName;
        }
      }
    });
  }
  
  // Also check for join aliases
  const joinMatches = sql.match(/JOIN\s+([a-zA-Z_"][a-zA-Z0-9_"]*)\s+(?:AS\s+)?([a-zA-Z][a-zA-Z0-9_]*)?/gi);
  if (joinMatches) {
    joinMatches.forEach(match => {
      const parts = match.split(/\s+/);
      if (parts.length >= 3) {
        const tableName = parts[1].replace(/"/g, '');
        const alias = parts[parts.indexOf('AS') + 1] || parts[2];
        if (alias && alias !== tableName) {
          tableAliases[alias] = tableName;
        }
      }
    });
  }
  
  console.log('Detected table aliases:', tableAliases);
  
  // Check for any column references that don't exist
  Object.entries(tableAliases).forEach(([alias, tableName]) => {
    // Look for pattern like "alias.column" in SQL
    const columnRefPattern = new RegExp(`${alias}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
    const columnMatches = [...sql.matchAll(columnRefPattern)];
    
    if (columnMatches.length > 0) {
      // Check if the referenced columns exist in the schema
      for (const match of columnMatches) {
        const columnName = match[1];
        const schemaTable = schema[tableName];
        
        if (!schemaTable) {
          result.hasIssues = true;
          result.issues.push(`Table "${tableName}" not found in schema`);
          continue;
        }
        
        const columnExists = schemaTable.some(col => col.name === columnName);
        if (!columnExists) {
          result.hasIssues = true;
          result.issues.push(`Column "${columnName}" not found in table "${tableName}"`);
        }
      }
    }
  });
  
  return result;
}

module.exports = {
  generateSqlQuery,
  updateModelConfig,
  getModelConfigs
}; 