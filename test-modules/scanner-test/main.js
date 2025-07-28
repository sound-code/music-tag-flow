const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const MusicLibraryFacade = require('./components/MusicLibraryFacade');

let mainWindow;
let musicLibrary;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: false // Per i test locali
    },
    title: 'Music Library Scanner Test'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.openDevTools(); // Always show dev tools for testing
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

// Initialize Music Library Facade with DI container when app starts
app.whenReady().then(async () => {
  musicLibrary = new MusicLibraryFacade();
  const success = await musicLibrary.init();
  if (success) {
    console.log('🎵 Music library initialized successfully with DI container');
    console.log('📦 Registered services:', musicLibrary.getRegisteredServices().join(', '));
  } else {
    console.error('❌ Failed to initialize music library');
    musicLibrary = null;
  }
});

// IPC handlers for file system access
ipcMain.handle('select-music-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Seleziona cartella libreria musicale'
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

ipcMain.handle('scan-directory', async (event, directory) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    throw new Error('Music library not ready');
  }

  return await musicLibrary.scanDirectory(directory, (progress) => {
    // Send progress updates to renderer
    mainWindow.webContents.send('scan-progress', progress);
  });
});

ipcMain.handle('get-stats', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return { tracks: 0, artists: 0, albums: 0 };
  }
  
  return await musicLibrary.getStats();
});

ipcMain.handle('search-tracks', async (event, query, options = {}) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.search(query, options);
});

ipcMain.handle('search-by-tag', async (event, tagName, tagValue = null) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.searchByTag(tagName, tagValue);
});

ipcMain.handle('search-by-genre', async (event, genre) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.searchByGenre(genre);
});

ipcMain.handle('search-by-era', async (event, era) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.searchByEra(era);
});

ipcMain.handle('get-all-tracks', async (event, limit = 100) => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.getAllTracks(limit);
});

ipcMain.handle('get-available-tags', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return [];
  }
  
  return await musicLibrary.getAvailableTags();
});

ipcMain.handle('get-tags-by-category', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return {};
  }
  
  return await musicLibrary.getTagsByCategory();
});

ipcMain.handle('clear-database', async () => {
  if (!musicLibrary || !musicLibrary.isReady()) {
    return false;
  }
  
  return musicLibrary.clearDatabase();
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (musicLibrary) {
    musicLibrary.close();
  }
}); 