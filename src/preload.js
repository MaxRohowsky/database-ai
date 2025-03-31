// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose API to renderer process
contextBridge.exposeInMainWorld('api', {
  // Database operations
  testConnection: () => ipcRenderer.invoke('db:testConnection'),
  getSchema: () => ipcRenderer.invoke('db:getSchema'),
  executeQuery: (query) => ipcRenderer.invoke('db:executeQuery', query),
  
  // AI operations
  generateSql: (naturalLanguage, schema) => ipcRenderer.invoke('ai:generateSql', naturalLanguage, schema)
});
