"use strict";

/**
 * File and dialog IPC: generic project file reads/writes, file stats, thumbnails
 * and the OS file pickers. Registered from main.cjs; the channel names are part
 * of the preload API and must stay exactly the same.
 */
module.exports = function registerFileIpc({
  ipcMain,
  app,
  dialog,
  shell,
  fs,
  path,
  rememberProjectRoot,
  isAllowedProjectPath,
  getMainWindow,
}) {


ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(getMainWindow(), {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    rememberProjectRoot(result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("select-project-file", async (_event, options = {}) => {
  const projectPath = options.projectPath || undefined;
  const result = await dialog.showOpenDialog(getMainWindow(), {
    title: options.title || "Select a file",
    defaultPath: projectPath,
    properties: ["openFile"],
    filters: options.filters || [
      { name: "Text files", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const abs = result.filePaths[0];
  if (projectPath) {
    const rel = path.relative(projectPath, abs);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.replace(/\\/g, "/");
  }
  return abs.replace(/\\/g, "/");
});

ipcMain.handle("select-tileset-file", async () => {
  const result = await dialog.showOpenDialog(getMainWindow(), {
    properties: ["openFile"],
    filters: [
      { name: "Tileset Images", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

// Read an arbitrary image file and return as data URL (for renderer use)
ipcMain.handle("read-file-dataurl", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = (filePath.split(".").pop() || "png").toLowerCase();
    const normalizedExt = ext === "jpg" ? "jpeg" : ext;
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString("base64");
    return `data:image/${normalizedExt};base64,${b64}`;
  } catch (e) {
    console.warn("read-file-dataurl failed for", filePath, e);
    return null;
  }
});

// Return project minimap thumbnail (data URL) if available
ipcMain.handle("get-project-thumbnail", async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const imagesMinimapPath = path.join(projectPath, "images", "minimap.png");
    const legacyMinimapPath = path.join(projectPath, "assets", "minimap.png");
    let minimapPath = imagesMinimapPath;
    if (!fs.existsSync(minimapPath) && fs.existsSync(legacyMinimapPath)) {
      minimapPath = legacyMinimapPath;
    }
    if (!fs.existsSync(minimapPath)) return null;
    const buf = fs.readFileSync(minimapPath);
    const b64 = buf.toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn("get-project-thumbnail failed:", e);
    return null;
  }
});

// Check if a project path still exists on disk
ipcMain.handle("check-project-exists", async (event, projectPath) => {
  try {
    if (!projectPath) return false;
    return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
  } catch (e) {
    console.warn("check-project-exists failed for", projectPath, e);
    return false;
  }
});

// Show a folder in the system file explorer
ipcMain.handle("show-item-in-folder", async (_event, folderPath) => {
  try {
    if (!folderPath) return false;
    if (!fs.existsSync(folderPath)) return false;
    shell.openPath(folderPath);
    return true;
  } catch (e) {
    console.warn("show-item-in-folder failed:", e);
    return false;
  }
});

// Copy entire project folder to a new location
ipcMain.handle("copy-project", async (_event, sourcePath, destPath) => {
  try {
    if (!sourcePath || !destPath) return { success: false, error: "Invalid paths" };
    if (!fs.existsSync(sourcePath)) return { success: false, error: "Source project not found" };

    const copyDirRecursive = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destEntryPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(srcPath, destEntryPath);
        } else {
          fs.copyFileSync(srcPath, destEntryPath);
        }
      }
    };

    copyDirRecursive(sourcePath, destPath);
    return { success: true };
  } catch (e) {
    console.warn("copy-project failed:", e);
    return { success: false, error: String(e.message || e) };
  }
});

// Get file stats for conflict detection (modified time and size)
ipcMain.handle("get-file-stats", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn("get-file-stats: File not found:", filePath);
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      modifiedTime: stats.mtimeMs || stats.mtime.getTime(),
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (e) {
    console.warn("get-file-stats failed for", filePath, e);
    return null;
  }
});

ipcMain.handle("read-file", async (event, filePath) => {
  try {
    if (!isAllowedProjectPath(filePath) || !fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
});

ipcMain.handle("create-folder-if-not-exists", async (_event, folderPath) => {
  try {
    if (!isAllowedProjectPath(folderPath)) return false;
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch (error) {
    console.error("Error creating folder:", folderPath, error);
    return false;
  }
});

ipcMain.handle("write-file", async (_event, filePath, content) => {
  try {
    if (!isAllowedProjectPath(filePath)) return false;
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (error) {
    console.error("Error writing file:", filePath, error);
    return false;
  }
});

ipcMain.handle("rename-project-file", async (_event, fromPath, toPath) => {
  try {
    if (!isAllowedProjectPath(fromPath) || !isAllowedProjectPath(toPath)) {
      return { success: false, error: "Path not allowed" };
    }
    if (path.resolve(fromPath) === path.resolve(toPath)) return { success: true };
    if (!fs.existsSync(fromPath)) return { success: false, error: "Source not found", missing: true };
    if (fs.existsSync(toPath)) return { success: false, error: "Target already exists" };
    const directory = path.dirname(toPath);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    fs.renameSync(fromPath, toPath);
    return { success: true };
  } catch (error) {
    console.error("Error renaming file:", fromPath, toPath, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("read-dir", async (_event, dirPath) => {
  try {
    if (!isAllowedProjectPath(dirPath) || !fs.existsSync(dirPath)) {
      return [];
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch (error) {
    console.error("Error reading directory:", dirPath, error);
    return [];
  }
});

ipcMain.handle("get-project-folder", async () => {
  try {
    return app.getPath("documents");
  } catch (error) {
    console.error("Error retrieving project folder:", error);
    return null;
  }
});

ipcMain.handle("file-exists", async (_event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});
};
