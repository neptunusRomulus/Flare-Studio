const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  ipcMain: ipcMainLocal,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = !app.isPackaged;

const getPlatformIcon = () => {
  // PNG works for taskbar/window icon on both Windows and Linux
  return path.join(__dirname, "..", "public", "flare-studio-ico.png");
};

let mainWindow;

function createWindow() {
  const { screen } = require("electron");
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, screenW),
    height: Math.min(900, screenH),
    minWidth: Math.min(1200, screenW),
    minHeight: Math.min(800, screenH),
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: getPlatformIcon(),
    title: "Isometric Tile Map Editor",
  });

  // Load the app
  if (isDev) {
    // Vite dev server runs on 5173
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Map",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("menu-new-map");
          },
        },
        {
          label: "Open Map",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow.webContents.send("menu-open-map");
          },
        },
        {
          label: "Save Map",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("menu-save-map");
          },
        },
        { type: "separator" },
        {
          label: "Export TMX",
          click: () => {
            mainWindow.webContents.send("menu-export-tmx");
          },
        },
        {
          label: "Export Flare TXT",
          click: () => {
            mainWindow.webContents.send("menu-export-flare");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => {
            mainWindow.webContents.send("menu-undo");
          },
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () => {
            mainWindow.webContents.send("menu-redo");
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forcereload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            mainWindow.webContents.send("menu-about");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Basic IPC handlers for file operations
ipcMainLocal.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMainLocal.handle("select-tileset-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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

ipcMainLocal.handle("file-exists", async (_event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});

ipcMainLocal.handle("create-map-project", async (_event, config) => {
  try {
    if (!config || typeof config.name !== "string" || typeof config.location !== "string") {
      return { success: false, error: "Invalid project configuration" };
    }

    const projectDir = path.join(config.location, config.name.trim());
    await fs.promises.mkdir(projectDir, { recursive: true });
    return { success: true, projectPath: projectDir };
  } catch (error) {
    console.error("create-map-project failed:", error);
    return { success: false, error: error?.message || "Unable to create project folder" };
  }
});

ipcMainLocal.handle("check-project-exists", async (_event, projectPath) => {
  try {
    await fs.promises.access(projectPath);
    return true;
  } catch {
    return false;
  }
});

ipcMainLocal.handle("get-project-thumbnail", async () => {
  return null;
});

// Window controls
ipcMainLocal.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMainLocal.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMainLocal.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle app protocol for development
if (isDev) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
