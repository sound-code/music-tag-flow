const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'pianta_musica-removebg-preview.png')
  });

  // Load main application
  mainWindow.loadFile('index.html');

  // Automatically open DevTools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Music Library System - using existing components from test-modules
let musicLibrary = null;

// Initialize Music Library when app is ready
app.whenReady().then(async () => {
  try {
    // Import the MusicLibraryFacade
    const MusicLibraryFacade = require('./test-modules/scanner-test/components/MusicLibraryFacade');
    
    // Initialize the music library system
    musicLibrary = new MusicLibraryFacade();
    const success = await musicLibrary.init();
    
    if (success) {
    } else {
      console.error('❌ Failed to initialize music library system');
      musicLibrary = null;
    }
  } catch (error) {
    console.error('Error initializing music library:', error);
    musicLibrary = null;
  }
});

// IPC Handlers for Music Library Operations

// Select directory for scanning
ipcMain.handle('select-music-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Music Library Folder'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error selecting directory:', error);
    return null;
  }
});

// Scan directory for music files
ipcMain.handle('scan-directory', async (event, directory) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    throw new Error('Music library system not ready');
  }

  try {
    
    const results = await musicLibrary.scanDirectory(directory, (progress) => {
      // Send progress updates to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan-progress', progress);
      }
    });
    
    return results;
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
});

// Get library statistics
ipcMain.handle('get-stats', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return { tracks: 0, artists: 0, albums: 0 };
  }
  
  try {
    return await musicLibrary.getStats();
  } catch (error) {
    console.error('Error getting stats:', error);
    return { tracks: 0, artists: 0, albums: 0 };
  }
});

// Search operations
ipcMain.handle('search-tracks', async (event, query, options = {}) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  try {
    return await musicLibrary.search(query, options);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
});

ipcMain.handle('get-all-tracks', async (event, limit = 100) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  try {
    return await musicLibrary.getAllTracks(limit);
  } catch (error) {
    console.error('Error getting tracks:', error);
    return [];
  }
});

// Clear database
ipcMain.handle('clear-database', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return false;
  }
  
  try {
    return await musicLibrary.clearDatabase();
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (musicLibrary) {
    try {
      musicLibrary.close();
    } catch (error) {
      console.error('Error closing music library:', error);
    }
  }
});