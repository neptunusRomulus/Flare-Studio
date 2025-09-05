const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  createMapProject: (config) => ipcRenderer.invoke('create-map-project', config),
  openMapProject: (projectPath) => ipcRenderer.invoke('open-map-project', projectPath),
  saveMapProject: (projectPath, mapData) => ipcRenderer.invoke('save-map-project', projectPath, mapData),
  discoverTilesetImages: (projectPath) => ipcRenderer.invoke('discover-tileset-images', projectPath)
});
