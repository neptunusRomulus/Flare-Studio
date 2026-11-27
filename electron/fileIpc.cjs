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

ipcMain.handle("import-into-project", async (_event, options = {}) => {
  try {
    const projectPath = options.projectPath;
    const destDir = String(options.destDir || "").replace(/\\/g, "/").replace(/^[\/]+/, "").replace(/\/+$/, "");
    if (!projectPath || !destDir) return { success: false, error: "Missing project or destination" };
    const destRoot = path.join(projectPath, destDir);
    if (!isAllowedProjectPath(destRoot)) return { success: false, error: "Path not allowed" };
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: options.title || "Select a file",
      properties: ["openFile"],
      filters: options.filters || [{ name: "All files", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePaths.length) return { success: false, cancelled: true };
    const source = result.filePaths[0];
    const name = path.basename(source);
    if (!name || name === "." || name === "..") return { success: false, error: "Invalid filename" };
    fs.mkdirSync(destRoot, { recursive: true });
    const dest = path.join(destRoot, name);
    if (!isAllowedProjectPath(dest)) return { success: false, error: "Path not allowed" };
    if (fs.existsSync(dest)) return { success: false, error: "A file with that name already exists" };
    fs.copyFileSync(source, dest);
    const rel = `${destDir}/${name}`.replace(/\\/g, "/");
    return { success: true, rel, name };
  } catch (error) {
    console.error("import-into-project failed:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-icon-files", async (_event, options = {}) => {
  try {
    const projectPath = options.projectPath;
    const destDir = String(options.destDir || "images/icons/studio").replace(/\\/g, "/").replace(/^[\/]+/, "").replace(/\/+$/, "");
    if (!projectPath || !destDir) return { success: false, error: "Missing project or destination" };
    const destRoot = path.join(projectPath, destDir);
    if (!isAllowedProjectPath(destRoot)) return { success: false, error: "Path not allowed" };
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: options.title || "Import power icons",
      properties: ["openFile", "multiSelections"],
      filters: options.filters || [{ name: "PNG images", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePaths.length) return { success: false, cancelled: true };
    fs.mkdirSync(destRoot, { recursive: true });
    const files = [];
    const used = new Set(fs.existsSync(destRoot) ? fs.readdirSync(destRoot).map((name) => name.toLowerCase()) : []);
    for (const source of result.filePaths) {
      const base = path.basename(source);
      if (!base || base === "." || base === "..") continue;
      const stemRaw = base.toLowerCase().endsWith(".png") ? base.slice(0, -4) : base;
      const stem = stemRaw.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "icon";
      let name = `${stem}.png`;
      let index = 2;
      while (used.has(name.toLowerCase())) {
        name = `${stem}_${index}.png`;
        index += 1;
      }
      const dest = path.join(destRoot, name);
      if (!isAllowedProjectPath(dest)) return { success: false, error: "Path not allowed" };
      fs.copyFileSync(source, dest);
      used.add(name.toLowerCase());
      files.push({ rel: `${destDir}/${name}`.replace(/\\/g, "/"), name });
    }
    if (!files.length) return { success: false, error: "No icons were imported" };
    return { success: true, files };
  } catch (error) {
    console.error("import-icon-files failed:", error);
    return { success: false, error: error.message };
  }
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
    const mime = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      ttf: "font/ttf",
      otf: "font/otf",
      woff: "font/woff",
    }[ext] || `application/octet-stream`;
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString("base64");
    return `data:${mime};base64,${b64}`;
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
    // Opening an arbitrary path launches whatever it points at (an .exe on
    // Windows), and the renderer is the one naming it.
    if (!isAllowedProjectPath(folderPath)) return false;
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
    if (!isAllowedProjectPath(sourcePath)) return { success: false, error: "Path not allowed" };
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

ipcMain.handle("write-file-dataurl", async (_event, filePath, dataUrl) => {
  try {
    if (!isAllowedProjectPath(filePath)) return false;
    const raw = String(dataUrl || "");
    const match = raw.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) return false;
    const buffer = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (error) {
    console.error("Error writing data URL file:", filePath, error);
    return false;
  }
});


ipcMain.handle("delete-project-file", async (_event, filePath) => {
  try {
    if (!isAllowedProjectPath(filePath)) return { success: false, error: "Path not allowed" };
    if (!fs.existsSync(filePath)) return { success: false, error: "File not found", missing: true };
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { success: false, error: "Not a file" };
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting file:", filePath, error);
    return { success: false, error: error.message };
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
