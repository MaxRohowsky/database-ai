// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose API to renderer process
contextBridge.exposeInMainWorld('api', {
  // Database operations
  testConnection: (config) => ipcRenderer.invoke('db:testConnection', config),
  connectToDatabase: (config) => ipcRenderer.invoke('db:connectToDatabase', config),
  getSchema: () => ipcRenderer.invoke('db:getSchema'),
  executeQuery: (query) => ipcRenderer.invoke('db:executeQuery', query),
  
  // AI operations
  generateSql: (naturalLanguage, schema, provider) => ipcRenderer.invoke('ai:generateSql', naturalLanguage, schema, provider),
  updateModelConfig: (provider, config) => ipcRenderer.invoke('ai:updateModelConfig', provider, config),
  getModelConfigs: () => ipcRenderer.invoke('ai:getModelConfigs')
});
