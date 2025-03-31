const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate SQL from natural language query
 * @param {string} naturalLanguageQuery - User's natural language query
 * @param {Object} databaseSchema - Database schema information
 * @returns {Promise<string>} Generated SQL query
 */
async function generateSqlQuery(naturalLanguageQuery, databaseSchema) {
  try {
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

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for more deterministic responses
      max_tokens: 1000
    });

    // Extract the SQL query
    const generatedSQL = response.choices[0].message.content.trim();
    
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
  generateSqlQuery
}; 