// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const schemaIndicator = document.getElementById('schema-indicator');
const naturalQueryInput = document.getElementById('natural-query');
const generateBtn = document.getElementById('generate-btn');
const sqlOutput = document.getElementById('sql-output');
const runSqlBtn = document.getElementById('run-sql-btn');
const resultsContainer = document.getElementById('results-container');
const chatContainer = document.querySelector('.chat-container');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistoryContainer = document.querySelector('.chat-history');
const deleteChatBtn = document.getElementById('delete-chat-btn');

// Database Connection Elements
const connectionModal = document.getElementById('connection-modal');
const connectionForm = document.getElementById('connection-form');
const modalTitle = document.getElementById('modal-title');
const connectionId = document.getElementById('connection-id');
const connectionName = document.getElementById('connection-name');
const connectionHost = document.getElementById('connection-host');
const connectionPort = document.getElementById('connection-port');
const connectionDatabase = document.getElementById('connection-database');
const connectionUser = document.getElementById('connection-user');
const connectionPassword = document.getElementById('connection-password');
const testConnectionBtn = document.getElementById('test-connection-btn');
const deleteConnectionBtn = document.getElementById('delete-connection-btn');
const addConnectionBtn = document.getElementById('add-connection-btn');
const connectionDropdownTrigger = document.querySelector('.dropdown-trigger');
const databaseList = document.getElementById('database-list');
const closeModalBtn = document.querySelector('.close-modal');

// Global state
let databaseSchema = null;
let currentSqlQuery = null;
let currentChatId = `chat-${Date.now()}`;
let chatHistory = [];
let databaseConnections = [];
let currentConnectionId = null;

// Initialize the application
async function init() {
  // Load database connections from local storage
  loadDatabaseConnections();
  
  // Try to connect to the last used connection, if any
  const lastConnectionId = localStorage.getItem('lastConnectionId');
  if (lastConnectionId) {
    const connection = databaseConnections.find(conn => conn.id === lastConnectionId);
    if (connection) {
      connectToDatabase(connection);
    }
  }
  
  // Load chat history
  loadChatHistory();
}

// Load database connections from local storage
function loadDatabaseConnections() {
  databaseConnections = JSON.parse(localStorage.getItem('databaseConnections') || '[]');
  renderDatabaseList();
}

// Save database connections to local storage
function saveDatabaseConnections() {
  localStorage.setItem('databaseConnections', JSON.stringify(databaseConnections));
  renderDatabaseList();
}

// Render the database connections list
function renderDatabaseList() {
  databaseList.innerHTML = '';
  
  if (databaseConnections.length === 0) {
    const noConnectionsItem = document.createElement('div');
    noConnectionsItem.className = 'connection-item';
    noConnectionsItem.textContent = 'No connections available';
    databaseList.appendChild(noConnectionsItem);
    return;
  }
  
  databaseConnections.forEach(connection => {
    const connectionItem = document.createElement('div');
    connectionItem.className = `connection-item ${connection.id === currentConnectionId ? 'active' : ''}`;
    connectionItem.setAttribute('data-id', connection.id);
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'connection-name';
    nameDiv.textContent = connection.name;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'connection-actions';
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'connection-edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit connection';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditConnectionModal(connection);
    });
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'connection-delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete connection';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete the "${connection.name}" connection?`)) {
        deleteConnection(connection.id);
      }
    });
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    connectionItem.appendChild(nameDiv);
    connectionItem.appendChild(actionsDiv);
    
    // Connect to this database when clicked
    connectionItem.addEventListener('click', () => {
      connectToDatabase(connection);
    });
    
    databaseList.appendChild(connectionItem);
  });
}

// Connect to a database
async function connectToDatabase(connection) {
  try {
    displayStatusMessage(`Connecting to ${connection.name}...`);
    
    // Call the API to connect to the database
    const connected = await window.api.connectToDatabase({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      password: connection.password
    });
    
    if (connected) {
      // Update current connection ID
      currentConnectionId = connection.id;
      localStorage.setItem('lastConnectionId', connection.id);
      
      // Update UI
      updateConnectionStatus(true, connection.name);
      
      // Fetch database schema
      databaseSchema = await window.api.getSchema();
      
      if (databaseSchema && Object.keys(databaseSchema).length > 0) {
        displaySchemaInfo(databaseSchema);
        displayStatusMessage(`Connected to ${connection.name}`);
      } else {
        displayStatusMessage(`Connected to ${connection.name} but no tables found`, true);
      }
      
      // Render the database list to show active connection
      renderDatabaseList();
    } else {
      throw new Error('Failed to connect to database');
    }
  } catch (error) {
    console.error('Connection error:', error);
    displayStatusMessage(`Error connecting to ${connection.name}: ${error.message}`, true);
    updateConnectionStatus(false);
  }
}

// Test connection to database
async function testDatabaseConnection() {
  // Get connection details from form
  const connectionDetails = {
    host: connectionHost.value,
    port: parseInt(connectionPort.value),
    database: connectionDatabase.value,
    user: connectionUser.value,
    password: connectionPassword.value
  };
  
  try {
    displayStatusMessage('Testing connection...');
    
    // Call the API to test the connection
    const connected = await window.api.testConnection(connectionDetails);
    
    if (connected) {
      displayStatusMessage('Connection successful!');
      return true;
    } else {
      displayStatusMessage('Connection failed', true);
      return false;
    }
  } catch (error) {
    console.error('Test connection error:', error);
    displayStatusMessage(`Connection failed: ${error.message}`, true);
    return false;
  }
}

// Show add connection modal
function showAddConnectionModal() {
  modalTitle.textContent = 'Connect to Database';
  connectionId.value = '';
  connectionForm.reset();
  deleteConnectionBtn.style.display = 'none';
  connectionModal.classList.add('show');
}

// Show edit connection modal
function showEditConnectionModal(connection) {
  modalTitle.textContent = 'Edit Database Connection';
  connectionId.value = connection.id;
  connectionName.value = connection.name;
  connectionHost.value = connection.host;
  connectionPort.value = connection.port;
  connectionDatabase.value = connection.database;
  connectionUser.value = connection.user;
  connectionPassword.value = connection.password;
  deleteConnectionBtn.style.display = 'block';
  connectionModal.classList.add('show');
}

// Hide connection modal
function hideConnectionModal() {
  connectionModal.classList.remove('show');
}

// Handle connection form submit
async function handleConnectionFormSubmit(e) {
  e.preventDefault();
  
  // Get connection details from form
  const connectionDetails = {
    name: connectionName.value,
    host: connectionHost.value,
    port: parseInt(connectionPort.value),
    database: connectionDatabase.value,
    user: connectionUser.value,
    password: connectionPassword.value
  };
  
  // Check if editing or adding
  const isEditing = connectionId.value !== '';
  
  if (isEditing) {
    // Update existing connection
    const index = databaseConnections.findIndex(conn => conn.id === connectionId.value);
    if (index !== -1) {
      connectionDetails.id = connectionId.value;
      databaseConnections[index] = connectionDetails;
      saveDatabaseConnections();
      
      // If the current connection was updated, reconnect
      if (currentConnectionId === connectionId.value) {
        connectToDatabase(connectionDetails);
      }
      
      displayStatusMessage(`Connection "${connectionDetails.name}" updated`);
    }
  } else {
    // Add new connection
    connectionDetails.id = `conn-${Date.now()}`;
    databaseConnections.push(connectionDetails);
    saveDatabaseConnections();
    displayStatusMessage(`Connection "${connectionDetails.name}" added`);
    
    // Connect to the new database
    connectToDatabase(connectionDetails);
  }
  
  hideConnectionModal();
}

// Delete a database connection
function deleteConnection(id) {
  // Find index
  const index = databaseConnections.findIndex(conn => conn.id === id);
  if (index === -1) return;
  
  // Get connection name
  const connectionName = databaseConnections[index].name;
  
  // Remove connection
  databaseConnections.splice(index, 1);
  saveDatabaseConnections();
  
  // If current connection was deleted, disconnect
  if (currentConnectionId === id) {
    currentConnectionId = null;
    localStorage.removeItem('lastConnectionId');
    updateConnectionStatus(false);
    databaseSchema = null;
  }
  
  displayStatusMessage(`Connection "${connectionName}" deleted`);
}

// Display schema information in the UI
function displaySchemaInfo(schema) {
  // Get the table count
  const tableCount = Object.keys(schema).length;
  
  // Update schema indicator
  let tablesText = Object.keys(schema).slice(0, 3).join(', ');
  if (Object.keys(schema).length > 3) {
    tablesText += `, +${Object.keys(schema).length - 3} more`;
  }
  schemaIndicator.textContent = `Schema loaded: ${tablesText}`;
  schemaIndicator.style.color = 'var(--success-color)';
  
  // Add table names as a placeholder suggestion in the textarea
  const tableSuggestion = Object.keys(schema).slice(0, 3).join(', ');
  naturalQueryInput.placeholder = `Ask a question about ${tableSuggestion}...`;
  
  console.log(`Schema loaded with ${tableCount} tables`);
}

// Update the connection status UI
function updateConnectionStatus(connected, connectionName = '') {
  if (connected) {
    connectionStatus.textContent = `Database: Connected (${connectionName})`;
    connectionStatus.className = 'status connected dropdown-trigger';
    
    // Enable UI based on connection status
    generateBtn.disabled = false;
  } else {
    connectionStatus.textContent = 'Database: Disconnected';
    connectionStatus.className = 'status disconnected dropdown-trigger';
    
    // Update schema indicator based on connection
    schemaIndicator.textContent = 'No Schema (Disconnected)';
    schemaIndicator.style.color = '#888';
    
    // Disable UI based on connection status
    generateBtn.disabled = true;
  }
}

// Display a status message
function displayStatusMessage(message, isError = false) {
  const statusMessageElement = document.createElement('div');
  statusMessageElement.className = 'status-message';
  statusMessageElement.textContent = message;
  statusMessageElement.style.color = isError ? 'var(--error-color)' : 'var(--success-color)';
  
  // Add it to the header
  document.querySelector('.status-info').appendChild(statusMessageElement);
  
  // Clear the message after 5 seconds
  setTimeout(() => {
    statusMessageElement.remove();
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
  
  // Add user query to chat
  addUserMessage(naturalLanguage);
  
  try {
    displayStatusMessage(`Generating SQL...`);
    generateBtn.disabled = true;
    
    // Call the AI service to generate SQL
    currentSqlQuery = await window.api.generateSql(naturalLanguage, databaseSchema);
    
    // Add the SQL message to chat
    addSqlMessage(currentSqlQuery);
    
    // Enable the run button
    displayStatusMessage('SQL generated successfully');
    
    // Save this chat to history
    saveChatToHistory(naturalLanguage);
  } catch (error) {
    console.error('SQL generation error:', error);
    displayStatusMessage(`Error: ${error.message}`, true);
    addErrorMessage(`Error generating SQL: ${error.message}`);
  } finally {
    generateBtn.disabled = false;
    
    // Clear input field
    naturalQueryInput.value = '';
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
    
    // Execute the query
    const result = await window.api.executeQuery(currentSqlQuery);
    
    // Display the results
    addResultMessage(result);
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
      
      // Add error message to chat
      addErrorMessage(errorMessage);
    } else {
      displayStatusMessage(`Error: ${error.message}`, true);
      addErrorMessage(`Error executing query: ${error.message}`);
    }
  } finally {
    runSqlBtn.disabled = false;
  }
}

// Add user message to chat
function addUserMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // Add delete icon to the message
  const deleteIcon = document.createElement('span');
  deleteIcon.className = 'delete-message-icon';
  deleteIcon.innerHTML = '🗑️'; // Bin emoji
  deleteIcon.title = "Delete message";
  deleteIcon.addEventListener('click', () => {
    if (confirm('Delete this message?')) {
      messageDiv.remove();
      saveChatToHistory('Message deleted');
    }
  });
  
  const messageContent = document.createElement('p');
  messageContent.textContent = text;
  
  contentDiv.appendChild(deleteIcon);
  contentDiv.appendChild(messageContent);
  messageDiv.appendChild(contentDiv);
  
  chatContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Add SQL message to chat
function addSqlMessage(sql) {
  // Remove the current SQL template message if it exists
  const existingSqlMessages = document.querySelectorAll('.sql-message.empty');
  existingSqlMessages.forEach(msg => msg.remove());
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message sql-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Generated SQL';
  
  const pre = document.createElement('pre');
  pre.textContent = sql;
  pre.className = 'sql-content';
  // Make the pre element clickable to edit in place
  pre.addEventListener('click', () => {
    makePreEditable(pre, sql);
  });
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'sql-buttons';
  
  const executeButton = document.createElement('button');
  executeButton.textContent = 'Execute';
  executeButton.className = 'execute-btn';
  executeButton.addEventListener('click', executeQuery);
  
  buttonContainer.appendChild(executeButton);
  
  contentDiv.appendChild(heading);
  contentDiv.appendChild(pre);
  contentDiv.appendChild(buttonContainer);
  messageDiv.appendChild(contentDiv);
  
  chatContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Make pre element editable by replacing it with a textarea
function makePreEditable(preElement, originalSql) {
  const messageDiv = preElement.closest('.sql-message');
  const contentDiv = messageDiv.querySelector('.message-content');
  const buttonContainer = messageDiv.querySelector('.sql-buttons');
  
  // Store original SQL for reset
  messageDiv.setAttribute('data-original-sql', originalSql);
  
  // Create textarea with same content
  const textarea = document.createElement('textarea');
  textarea.className = 'editable-sql';
  textarea.value = preElement.textContent;
  
  // Replace the pre with textarea
  contentDiv.replaceChild(textarea, preElement);
  
  // Add edit instructions tooltip
  showEditInstructions();
  
  // Focus the textarea
  textarea.focus();
  
  // Add keyboard shortcut to finish editing (Ctrl+Enter)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finishEditing(textarea);
    }
  });
  
  // Check if reset button already exists
  if (!buttonContainer.querySelector('.reset-sql-btn')) {
    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.className = 'reset-sql-btn';
    resetButton.addEventListener('click', () => {
      // Restore original SQL
      textarea.value = messageDiv.getAttribute('data-original-sql');
    });
    
    // Add it before the execute button
    buttonContainer.insertBefore(resetButton, buttonContainer.firstChild);
  }
  
  // Update execute button to use the textarea value
  const executeButton = buttonContainer.querySelector('.execute-btn');
  executeButton.removeEventListener('click', executeQuery);
  executeButton.addEventListener('click', () => {
    // Update current SQL and execute
    currentSqlQuery = textarea.value;
    executeQuery();
  });
}

// Show editing instructions tooltip
function showEditInstructions() {
  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'edit-tooltip';
  tooltip.textContent = 'Press Ctrl+Enter to finish editing';
  document.body.appendChild(tooltip);
  
  // Position it at the bottom of the screen
  tooltip.style.position = 'fixed';
  tooltip.style.bottom = '20px';
  tooltip.style.left = '50%';
  tooltip.style.transform = 'translateX(-50%)';
  
  // Remove after 4 seconds
  setTimeout(() => {
    if (document.body.contains(tooltip)) {
      document.body.removeChild(tooltip);
    }
  }, 4000);
}

// Convert textarea back to pre after editing
function finishEditing(textarea) {
  const messageDiv = textarea.closest('.sql-message');
  const contentDiv = messageDiv.querySelector('.message-content');
  const buttonContainer = messageDiv.querySelector('.sql-buttons');
  
  // Get the edited SQL
  const sql = textarea.value;
  currentSqlQuery = sql;
  
  // Create new pre element
  const pre = document.createElement('pre');
  pre.className = 'sql-content';
  pre.textContent = sql;
  
  // Add click listener to make it editable again
  pre.addEventListener('click', () => {
    makePreEditable(pre, messageDiv.getAttribute('data-original-sql'));
  });
  
  // Replace textarea with pre
  contentDiv.replaceChild(pre, textarea);
  
  // If content was changed, add an indicator
  if (sql !== messageDiv.getAttribute('data-original-sql')) {
    const heading = contentDiv.querySelector('h3');
    if (!heading.querySelector('.edited-indicator')) {
      const editedSpan = document.createElement('span');
      editedSpan.className = 'edited-indicator';
      editedSpan.textContent = '(Edited)';
      heading.appendChild(editedSpan);
    }
  }
  
  // Remove reset button if exists
  const resetButton = buttonContainer.querySelector('.reset-sql-btn');
  if (resetButton) {
    buttonContainer.removeChild(resetButton);
  }
  
  // Restore execute button behavior
  const executeButton = buttonContainer.querySelector('.execute-btn');
  executeButton.removeEventListener('click', executeQuery);
  executeButton.addEventListener('click', executeQuery);
  
  // Save to chat history
  saveChatToHistory('Edited SQL query');
}

// Add result message to chat
function addResultMessage(result) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message result-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Query Results';
  
  const resultContent = document.createElement('div');
  resultContent.className = 'result-content';
  
  contentDiv.appendChild(heading);
  contentDiv.appendChild(resultContent);
  messageDiv.appendChild(contentDiv);
  
  chatContainer.appendChild(messageDiv);
  
  // Now fill in the results
  if (!result || !result.rows || result.rows.length === 0) {
    resultContent.innerHTML = '<div class="placeholder">No results returned</div>';
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
  resultContent.innerHTML = '';
  resultContent.appendChild(table);
  
  // Add row count information
  const rowCount = document.createElement('div');
  rowCount.className = 'result-count';
  rowCount.textContent = `${result.rows.length} row${result.rows.length !== 1 ? 's' : ''} returned`;
  resultContent.appendChild(rowCount);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Add error message to chat
function addErrorMessage(errorText) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message error-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Error';
  
  const errorContent = document.createElement('p');
  errorContent.className = 'error-text';
  errorContent.textContent = errorText;
  
  contentDiv.appendChild(heading);
  contentDiv.appendChild(errorContent);
  messageDiv.appendChild(contentDiv);
  
  chatContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Start a new chat
function startNewChat() {
  // Clear chat container
  chatContainer.innerHTML = '';
  
  // Reset current query
  currentSqlQuery = null;
  
  // Generate new chat ID
  currentChatId = `chat-${Date.now()}`;
  
  // Don't add empty SQL message
  
  // Clear input field
  naturalQueryInput.value = '';
  
  displayStatusMessage('New chat started');
}

// Save chat to history
function saveChatToHistory(queryText) {
  // Create a chat entry
  const chatEntry = {
    id: currentChatId,
    title: queryText.length > 30 ? queryText.substring(0, 30) + '...' : queryText,
    timestamp: new Date().toISOString(),
    content: chatContainer.innerHTML
  };
  
  // Add to local storage
  const existingHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  
  // Check if this chat already exists
  const existingIndex = existingHistory.findIndex(chat => chat.id === currentChatId);
  
  if (existingIndex !== -1) {
    // Update existing chat
    existingHistory[existingIndex] = chatEntry;
  } else {
    // Add new chat
    existingHistory.push(chatEntry);
  }
  
  // Save back to storage
  localStorage.setItem('chatHistory', JSON.stringify(existingHistory));
  
  // Update chat history display
  loadChatHistory();
}

// Load chat history
function loadChatHistory() {
  const historyContainer = chatHistoryContainer;
  
  // Clear existing entries except the title
  const historyTitle = document.querySelector('.history-title');
  historyContainer.innerHTML = '';
  historyContainer.appendChild(historyTitle);
  
  // Get history from local storage
  const chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  
  // Sort by most recent
  chatHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Add each chat to the sidebar
  chatHistory.forEach(chat => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.setAttribute('data-chat-id', chat.id);
    
    // Add title span
    const titleSpan = document.createElement('span');
    titleSpan.className = 'history-item-title';
    titleSpan.textContent = chat.title;
    titleSpan.addEventListener('click', () => loadChat(chat));
    
    // Add delete icon
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'delete-chat-icon';
    deleteIcon.innerHTML = '🗑️'; // Bin emoji as the delete icon
    deleteIcon.title = "Delete chat";
    deleteIcon.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering the parent click event
      deleteChat(chat.id);
    });
    
    historyItem.appendChild(titleSpan);
    historyItem.appendChild(deleteIcon);
    
    historyContainer.appendChild(historyItem);
  });
}

// Load a specific chat
function loadChat(chat) {
  // Set current chat ID
  currentChatId = chat.id;
  
  // Load chat content
  chatContainer.innerHTML = chat.content;
  
  // Re-attach event handlers to all buttons in the chat
  reattachEventHandlers();
  
  // Get the last SQL query if any
  const sqlMessages = document.querySelectorAll('.sql-message:not(.empty)');
  if (sqlMessages.length > 0) {
    const lastSqlMessage = sqlMessages[sqlMessages.length - 1];
    const sqlText = lastSqlMessage.querySelector('pre').textContent;
    currentSqlQuery = sqlText;
  }
  
  displayStatusMessage(`Loaded chat: ${chat.title}`);
}

// Re-attach event handlers to buttons and interactive elements
function reattachEventHandlers() {
  // Re-attach execute buttons
  document.querySelectorAll('.execute-btn').forEach(button => {
    const messageDiv = button.closest('.sql-message');
    const textarea = messageDiv.querySelector('.editable-sql');
    
    // If there's a textarea, use its value, otherwise use the default executeQuery
    if (textarea) {
      button.removeEventListener('click', executeQuery);
      button.addEventListener('click', () => {
        currentSqlQuery = textarea.value;
        executeQuery();
      });
    } else {
      button.addEventListener('click', executeQuery);
    }
  });
  
  // Re-attach reset buttons
  document.querySelectorAll('.reset-sql-btn').forEach(button => {
    button.addEventListener('click', () => {
      const messageDiv = button.closest('.sql-message');
      const textarea = messageDiv.querySelector('.editable-sql');
      if (textarea && messageDiv.hasAttribute('data-original-sql')) {
        textarea.value = messageDiv.getAttribute('data-original-sql');
      }
    });
  });
  
  // Make pre elements clickable for editing
  document.querySelectorAll('.sql-content').forEach(pre => {
    const messageDiv = pre.closest('.sql-message');
    pre.addEventListener('click', () => {
      makePreEditable(pre, pre.textContent);
    });
  });
}

// Event Listeners
generateBtn.addEventListener('click', generateSql);
newChatBtn.addEventListener('click', startNewChat);
runSqlBtn.addEventListener('click', executeQuery);
deleteChatBtn.addEventListener('click', deleteCurrentChat);

// Connection modal events
addConnectionBtn.addEventListener('click', showAddConnectionModal);
closeModalBtn.addEventListener('click', hideConnectionModal);
connectionForm.addEventListener('submit', handleConnectionFormSubmit);
testConnectionBtn.addEventListener('click', testDatabaseConnection);
deleteConnectionBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to delete this connection?')) {
    deleteConnection(connectionId.value);
    hideConnectionModal();
  }
});

// Close modal when clicking outside
connectionModal.addEventListener('click', (e) => {
  if (e.target === connectionModal) {
    hideConnectionModal();
  }
});

// Enter key in textarea
naturalQueryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    generateSql();
  }
});

// Delete a chat from history
function deleteChat(chatId) {
  // Ask for confirmation
  if (!confirm('Are you sure you want to delete this chat?')) {
    return;
  }
  
  // Get history from local storage
  const existingHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  
  // Filter out the chat with the specified ID
  const updatedHistory = existingHistory.filter(chat => chat.id !== chatId);
  
  // Save back to storage
  localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
  
  // Reload chat history display
  loadChatHistory();
  
  // If the current chat was deleted, start a new one
  if (chatId === currentChatId) {
    startNewChat();
  }
  
  displayStatusMessage('Chat deleted');
}

// Delete current chat
function deleteCurrentChat() {
  if (!currentChatId) {
    displayStatusMessage('No active chat to delete', true);
    return;
  }
  
  if (confirm('Are you sure you want to delete the current chat?')) {
    deleteChat(currentChatId);
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  init();
  startNewChat(); // Start with a new chat
}); 