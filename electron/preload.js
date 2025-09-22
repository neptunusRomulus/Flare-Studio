const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  confirmClose: (hasUnsavedChanges) => ipcRenderer.invoke('confirm-close', hasUnsavedChanges),
  onBeforeClose: (callback) => ipcRenderer.on('before-close', () => callback && callback()),
  onSaveAndClose: (callback) => ipcRenderer.on('save-and-close', () => callback && callback()),
  closeAfterSave: () => ipcRenderer.send('close-after-save'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectTilesetFile: () => ipcRenderer.invoke('select-tileset-file'),
  createMapProject: (config) => ipcRenderer.invoke('create-map-project', config),
  openMapProject: (projectPath) => ipcRenderer.invoke('open-map-project', projectPath),
  saveMapProject: (projectPath, mapData) => ipcRenderer.invoke('save-map-project', projectPath, mapData),
  saveExportFiles: (projectPath, projectName, mapTxt, tilesetDef, options) => ipcRenderer.invoke('save-export-files', projectPath, projectName, mapTxt, tilesetDef, options),
  discoverTilesetImages: (projectPath) => ipcRenderer.invoke('discover-tileset-images', projectPath),
    listMaps: (projectPath) => ipcRenderer.invoke('list-maps', projectPath),
    readMapFile: (projectPath, filename) => ipcRenderer.invoke('read-map-file', projectPath, filename),
  getProjectThumbnail: (projectPath) => ipcRenderer.invoke('get-project-thumbnail', projectPath),
  checkProjectExists: (projectPath) => ipcRenderer.invoke('check-project-exists', projectPath),
  // Menu event listeners
  onMenuNewMap: (callback) => ipcRenderer.on('menu-new-map', (_e) => callback && callback()),
  onMenuOpenMap: (callback) => ipcRenderer.on('menu-open-map', (_e) => callback && callback()),
  onMenuSaveMap: (callback) => ipcRenderer.on('menu-save-map', (_e) => callback && callback()),
  onMenuUndo: (callback) => ipcRenderer.on('menu-undo', (_e) => callback && callback()),
  onMenuRedo: (callback) => ipcRenderer.on('menu-redo', (_e) => callback && callback())
});
