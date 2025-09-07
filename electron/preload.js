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
  discoverTilesetImages: (projectPath) => ipcRenderer.invoke('discover-tileset-images', projectPath),
  getProjectThumbnail: (projectPath) => ipcRenderer.invoke('get-project-thumbnail', projectPath),
  // Menu event listeners
  onMenuNewMap: (callback) => ipcRenderer.on('menu-new-map', (_e) => callback && callback()),
  onMenuOpenMap: (callback) => ipcRenderer.on('menu-open-map', (_e) => callback && callback()),
  onMenuSaveMap: (callback) => ipcRenderer.on('menu-save-map', (_e) => callback && callback())
});
