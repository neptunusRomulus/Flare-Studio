const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  fileExists: (filePath) => ipcRenderer.invoke("file-exists", filePath),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  confirmClose: (hasUnsavedChanges) =>
    ipcRenderer.invoke("confirm-close", hasUnsavedChanges),
  onBeforeClose: (callback) =>
    ipcRenderer.on("before-close", () => callback && callback()),
  onSaveAndClose: (callback) =>
    ipcRenderer.on("save-and-close", () => callback && callback()),
  closeAfterSave: () => ipcRenderer.send("close-after-save"),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  selectTilesetFile: () => ipcRenderer.invoke("select-tileset-file"),
  createMapProject: (config) =>
    ipcRenderer.invoke("create-map-project", config),
  openMapProject: (projectPath, mapName) =>
    ipcRenderer.invoke("open-map-project", projectPath, mapName),
  saveMapProject: (projectPath, mapData) =>
    ipcRenderer.invoke("save-map-project", projectPath, mapData),
  saveExportFiles: (projectPath, projectName, mapTxt, tilesetDef, options) =>
    ipcRenderer.invoke(
      "save-export-files",
      projectPath,
      projectName,
      mapTxt,
      tilesetDef,
      options
    ),
  discoverTilesetImages: (projectPath) =>
    ipcRenderer.invoke("discover-tileset-images", projectPath),
  readFileAsDataURL: (filePath) =>
    ipcRenderer.invoke("read-file-dataurl", filePath),
  listMaps: (projectPath) => ipcRenderer.invoke("list-maps", projectPath),
  readMapFile: (projectPath, filename) =>
    ipcRenderer.invoke("read-map-file", projectPath, filename),
  updateSpawnFile: (projectPath, content) =>
    ipcRenderer.invoke("update-spawn-file", projectPath, content),
  readSpawnFile: (projectPath) =>
    ipcRenderer.invoke("read-spawn-file", projectPath),
  resolvePathRelative: (fromPath, toPath) =>
    ipcRenderer.invoke("resolve-path-relative", fromPath, toPath),
  getProjectThumbnail: (projectPath) =>
    ipcRenderer.invoke("get-project-thumbnail", projectPath),
  checkProjectExists: (projectPath) =>
    ipcRenderer.invoke("check-project-exists", projectPath),
  // Session management (per-project)
  readSession: (projectPath) => ipcRenderer.invoke("read-session", projectPath),
  writeSession: (projectPath, sessionData) =>
    ipcRenderer.invoke("write-session", projectPath, sessionData),
  // NPC file management
  createNpcFile: (projectPath, npcData) =>
    ipcRenderer.invoke("create-npc-file", projectPath, npcData),
  writeNpcFile: (projectPath, filename, content) =>
    ipcRenderer.invoke("write-npc-file", projectPath, filename, content),
  // Item file management
  createItemFile: (projectPath, itemData) =>
    ipcRenderer.invoke("create-item-file", projectPath, itemData),
  getItemCategories: (projectPath) =>
    ipcRenderer.invoke("get-item-categories", projectPath),
  createItemCategory: (projectPath, categoryName) =>
    ipcRenderer.invoke("create-item-category", projectPath, categoryName),
  ensureItemsFolders: (projectPath) =>
    ipcRenderer.invoke("ensure-items-folders", projectPath),
  getNextItemId: (projectPath) =>
    ipcRenderer.invoke("get-next-item-id", projectPath),
  listItems: (projectPath) => ipcRenderer.invoke("list-items", projectPath),
  readItemFile: (filePath) => ipcRenderer.invoke("read-item-file", filePath),
  writeItemFile: (filePath, itemData) =>
    ipcRenderer.invoke("write-item-file", filePath, itemData),
  listEnemies: (projectPath) => ipcRenderer.invoke("list-enemies", projectPath),
  saveEnemyPreset: (projectPath, filename, content) =>
    ipcRenderer.invoke("save-enemy-preset", projectPath, filename, content),
  // Menu event listeners
  onMenuNewMap: (callback) =>
    ipcRenderer.on("menu-new-map", (_e) => callback && callback()),
  onMenuOpenMap: (callback) =>
    ipcRenderer.on("menu-open-map", (_e) => callback && callback()),
  onMenuSaveMap: (callback) =>
    ipcRenderer.on("menu-save-map", (_e) => callback && callback()),
  onMenuUndo: (callback) =>
    ipcRenderer.on("menu-undo", (_e) => callback && callback()),
  onMenuRedo: (callback) =>
    ipcRenderer.on("menu-redo", (_e) => callback && callback()),
});
