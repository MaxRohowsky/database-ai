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

// Global state
let databaseSchema = null;
let currentSqlQuery = null;
let currentChatId = `chat-${Date.now()}`;
let chatHistory = [];

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
    
    // Load chat history
    loadChatHistory();
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
  naturalQueryInput.placeholder = `Ask a question about ${tableSuggestion}...`;
  
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