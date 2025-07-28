const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  // Music Library scanning operations
  selectMusicDirectory: () => ipcRenderer.invoke('select-music-directory'),
  scanDirectory: (directory) => ipcRenderer.invoke('scan-directory', directory),
  getStats: () => ipcRenderer.invoke('get-stats'),
  searchTracks: (query, options) => ipcRenderer.invoke('search-tracks', query, options),
  getAllTracks: (limit) => ipcRenderer.invoke('get-all-tracks', limit),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  
  // Listen for scan progress updates
  onScanProgress: (callback) => {
    ipcRenderer.on('scan-progress', (event, progress) => callback(progress));
  },
  
  // Remove all listeners (cleanup)
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});