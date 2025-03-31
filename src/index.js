const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const dbService = require('./services/database');
const aiService = require('./services/ai');

// Load environment variables
require('dotenv').config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Set up IPC handlers
function setupIPC() {
  // Database operations
  ipcMain.handle('db:testConnection', async () => {
    try {
      return await dbService.testConnection();
    } catch (error) {
      console.error('Connection test error:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  });

  ipcMain.handle('db:getSchema', async () => {
    try {
      console.log('Fetching database schema...');
      const schema = await dbService.getDatabaseSchema();
      console.log('Schema fetched successfully. Tables:', Object.keys(schema));
      
      // Log first few tables for debugging
      const sampleTables = Object.entries(schema).slice(0, 3);
      for (const [tableName, columns] of sampleTables) {
        console.log(`Table ${tableName} has ${columns.length} columns. First few:`, 
          columns.slice(0, 3).map(c => c.name).join(', '));
      }
      
      return schema;
    } catch (error) {
      console.error('Schema fetch error:', error);
      throw new Error(`Failed to get database schema: ${error.message}`);
    }
  });

  ipcMain.handle('db:executeQuery', async (_, query) => {
    try {
      console.log('Executing query:', query);
      const result = await dbService.executeQuery(query);
      console.log(`Query executed successfully. Rows returned: ${result.rowCount}`);
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  });

  // AI operations
  ipcMain.handle('ai:generateSql', async (_, naturalLanguage, schema) => {
    try {
      console.log('Generating SQL for query:', naturalLanguage);
      console.log('Using schema with tables:', Object.keys(schema).join(', '));
      const sql = await aiService.generateSqlQuery(naturalLanguage, schema);
      console.log('Generated SQL:', sql);
      return sql;
    } catch (error) {
      console.error('SQL generation error:', error);
      throw new Error(`SQL generation failed: ${error.message}`);
    }
  });
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  setupIPC();
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
