// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const schemaIndicator = document.getElementById('schema-indicator');
const naturalQueryInput = document.getElementById('natural-query');
const generateBtn = document.getElementById('generate-btn');
const sqlOutput = document.getElementById('sql-output');
const runSqlBtn = document.getElementById('run-sql-btn');
const resultsContainer = document.getElementById('results-container');
const statusMessage = document.getElementById('status-message');

// Global state
let databaseSchema = null;
let currentSqlQuery = null;

// Initialize the application
async function init() {
  // Test database connection
  try {
    const connected = await window.api.testConnection();
    updateConnectionStatus(connected);
    
    if (connected) {
      // Fetch database schema if connected
      databaseSchema = await window.api.getSchema();
      
      if (databaseSchema && Object.keys(databaseSchema).length > 0) {
        displaySchemaInfo(databaseSchema);
        displayStatusMessage(`Schema loaded: ${Object.keys(databaseSchema).length} tables available`);
      } else {
        displayStatusMessage('Connected but no tables found in schema', true);
      }
    }
  } catch (error) {
    console.error('Initialization error:', error);
    displayStatusMessage(`Error: ${error.message}`, true);
  }
}

// Display schema information in the UI
function displaySchemaInfo(schema) {
  // Get the table count
  const tableCount = Object.keys(schema).length;
  
  // Update the connection status to include table count
  connectionStatus.textContent = `Database: Connected (${tableCount} tables)`;
  
  // Update schema indicator
  let tablesText = Object.keys(schema).slice(0, 3).join(', ');
  if (Object.keys(schema).length > 3) {
    tablesText += `, +${Object.keys(schema).length - 3} more`;
  }
  schemaIndicator.textContent = `Schema loaded: ${tablesText}`;
  schemaIndicator.style.color = 'var(--success-color)';
  
  // Add table names as a placeholder suggestion in the textarea
  const tableSuggestion = Object.keys(schema).slice(0, 3).join(', ');
  naturalQueryInput.placeholder = `Enter your query in plain English (e.g., "Show all data from ${tableSuggestion}")`;
  
  console.log(`Schema loaded with ${tableCount} tables`);
}

// Update the connection status UI
function updateConnectionStatus(connected) {
  connectionStatus.textContent = `Database: ${connected ? 'Connected' : 'Disconnected'}`;
  connectionStatus.className = `status ${connected ? 'connected' : 'disconnected'}`;
  
  // Update schema indicator based on connection
  if (!connected) {
    schemaIndicator.textContent = 'No Schema (Disconnected)';
    schemaIndicator.style.color = '#888';
  }
  
  // Enable/disable UI based on connection status
  generateBtn.disabled = !connected;
}

// Display a status message
function displayStatusMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? 'var(--error-color)' : 'var(--success-color)';
  
  // Clear the message after 5 seconds
  setTimeout(() => {
    statusMessage.textContent = '';
  }, 5000);
}

// Generate SQL from natural language
async function generateSql() {
  const naturalLanguage = naturalQueryInput.value.trim();
  
  if (!naturalLanguage) {
    displayStatusMessage('Please enter a natural language query', true);
    return;
  }
  
  if (!databaseSchema) {
    displayStatusMessage('Database schema not available', true);
    return;
  }
  
  const tableCount = Object.keys(databaseSchema).length;
  if (tableCount === 0) {
    displayStatusMessage('No tables found in the database', true);
    return;
  }
  
  try {
    displayStatusMessage(`Generating SQL using schema (${tableCount} tables)...`);
    sqlOutput.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    // Call the AI service to generate SQL
    currentSqlQuery = await window.api.generateSql(naturalLanguage, databaseSchema);
    
    // Display the generated SQL
    sqlOutput.textContent = currentSqlQuery;
    
    // Enable the run button
    runSqlBtn.disabled = false;
    displayStatusMessage('SQL generated successfully');
  } catch (error) {
    console.error('SQL generation error:', error);
    displayStatusMessage(`Error: ${error.message}`, true);
    sqlOutput.textContent = '-- Error generating SQL --';
    runSqlBtn.disabled = true;
  } finally {
    generateBtn.disabled = false;
  }
}

// Execute the generated SQL query
async function executeQuery() {
  if (!currentSqlQuery) {
    displayStatusMessage('No SQL query to execute', true);
    return;
  }
  
  try {
    displayStatusMessage('Executing query...');
    runSqlBtn.disabled = true;
    
    // Clear previous results
    resultsContainer.innerHTML = '<div class="placeholder">Executing query...</div>';
    
    // Execute the query
    const result = await window.api.executeQuery(currentSqlQuery);
    
    // Display the results
    displayQueryResults(result);
    displayStatusMessage('Query executed successfully');
  } catch (error) {
    console.error('Query execution error:', error);
    
    // Check if it's a column not found error
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      // Extract the column name from the error message
      const columnMatch = error.message.match(/column\s+([^\s]+)\s+does not exist/i);
      const columnName = columnMatch ? columnMatch[1] : 'unknown';
      
      // Update the error message to be more helpful
      const errorMessage = `Error: Column "${columnName}" does not exist in the database schema`;
      displayStatusMessage(errorMessage, true);
      
      // Add a note in the results area
      resultsContainer.innerHTML = `
        <div class="error-container">
          <p class="error-title">SQL Error</p>
          <p class="error-message">${errorMessage}</p>
          <p class="error-hint">The AI generated SQL that referenced a column that doesn't exist in your database.</p>
          <p class="error-hint">Try rephrasing your query to use only existing columns.</p>
        </div>
      `;
    } else {
      displayStatusMessage(`Error: ${error.message}`, true);
      resultsContainer.innerHTML = '<div class="placeholder">Error executing query</div>';
    }
  } finally {
    runSqlBtn.disabled = false;
  }
}

// Display query results as a table
function displayQueryResults(result) {
  if (!result || !result.rows || result.rows.length === 0) {
    resultsContainer.innerHTML = '<div class="placeholder">No results returned</div>';
    return;
  }
  
  // Create table
  const table = document.createElement('table');
  
  // Create header row
  const headerRow = document.createElement('tr');
  const columns = Object.keys(result.rows[0]);
  
  columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column;
    headerRow.appendChild(th);
  });
  
  table.appendChild(headerRow);
  
  // Create data rows
  result.rows.forEach(row => {
    const tr = document.createElement('tr');
    
    columns.forEach(column => {
      const td = document.createElement('td');
      td.textContent = row[column] !== null ? row[column] : 'NULL';
      tr.appendChild(td);
    });
    
    table.appendChild(tr);
  });
  
  // Update the results container
  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(table);
  
  // Add row count information
  const rowCount = document.createElement('div');
  rowCount.className = 'status-message';
  rowCount.textContent = `${result.rows.length} row${result.rows.length !== 1 ? 's' : ''} returned`;
  resultsContainer.appendChild(rowCount);
}

// Event Listeners
generateBtn.addEventListener('click', generateSql);
runSqlBtn.addEventListener('click', executeQuery);

// Initialize the application
document.addEventListener('DOMContentLoaded', init); 