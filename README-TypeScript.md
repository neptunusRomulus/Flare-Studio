# Isometric Tile Editor - TypeScript + Vite + Electron

## 🚀 Quick Start

Run this single command to start development:

```bash
npm run go
```

Or use the Windows batch file:
```batch
start.bat
```

This will:
- ✅ Install dependencies (if needed)
- ✅ Start Vite dev server (http://localhost:5173)
- ✅ Launch Electron app automatically
- ✅ Enable hot reload for both web and Electron

## 🏗️ Project Structure

```
ism-tile/
├── src/
│   ├── types.ts              # Complete type definitions
│   └── main.ts               # Full TypeScript application
├── electron/
│   └── main.js               # Electron main process
├── dist/                     # Vite build output
├── package.json              # Dependencies & scripts
├── vite.config.js            # Vite configuration
├── tsconfig.json             # TypeScript config
├── start.bat                 # Quick start script
└── index.html                # Main HTML file
```

## 📦 Features Completed

### ✅ **Full TypeScript Conversion**
- **Complete type safety** with interfaces for all data structures
- **Strict TypeScript** configuration with comprehensive error checking
- **Class-based architecture** with proper encapsulation
- **Type-safe DOM manipulation** with proper element casting

### ✅ **Modern Development Stack**
- **Vite** - Lightning fast dev server with hot reload
- **Electron** - Native desktop app with system integration
- **Concurrent development** - Both web and Electron run simultaneously

### ✅ **Enhanced Electron Integration**
- **Native menus** with keyboard shortcuts
- **File system dialogs** for import/export
- **Window management** with proper sizing
- **Development vs production** build handling

### ✅ **Advanced Type System**
```typescript
interface TileLayer {
  id: number;
  name: string;
  data: number[];
  visible: boolean;
}

interface ExportFlareTXTParams {
  mapWidth: number;
  mapHeight: number;
  layers: TileLayer[];
  // ... complete type safety
}
```

## 🎯 Available Commands

```json
{
  "dev": "vite",                    // Web development server only
  "build": "tsc && vite build",     // Production build
  "electron": "electron .",         // Electron only
  "go": "npm run electron-dev",     // 🔥 MAIN COMMAND - Everything
  "electron-dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "pack": "electron-builder --dir", // Package for testing
  "dist": "electron-builder"        // Full distribution build
}
```

## 🔧 Development Workflow

### Daily Development:
```bash
npm run go
```

### Building for Distribution:
```bash
npm run build  # Build web assets
npm run dist   # Create installers
```

### Features:
- **Hot Reload**: Changes instantly reflect in both web and Electron
- **TypeScript Compilation**: Real-time error checking and IntelliSense
- **Concurrent Servers**: Vite and Electron run together seamlessly

## 🎨 Application Features

### Core Functionality:
- **Isometric Tile Editor** with 64x32 fixed tile size
- **Multi-layer Support** (Ground, Wall, Decor)
- **Collision Layer** editing
- **Object Placement** with properties
- **Import/Export** (TMX, TSX, Flare TXT formats)

### TypeScript Enhancements:
- **Type-safe exports** with parameter validation
- **Compile-time error detection**
- **Enhanced IDE support** with autocomplete
- **Refactoring safety** with proper type relationships

### Electron Features:
- **Native File Dialogs** for better UX
- **Keyboard Shortcuts** (Ctrl+S, Ctrl+Z, etc.)
- **Menu Integration** with native OS menus
- **Cross-platform Builds** (Windows, Mac, Linux)

## 🔨 Technical Details

### TypeScript Configuration:
- **Target**: ES2020 for modern JavaScript features
- **Strict Mode**: Maximum type safety
- **Module System**: ESNext with Vite bundling
- **Source Maps**: Full debugging support

### Vite Configuration:
- **Port**: 5173 (configurable)
- **Hot Reload**: Enabled for all file types
- **Build Output**: Optimized for production

### Electron Configuration:
- **Main Process**: Node.js with full system access
- **Renderer**: Chromium with TypeScript/Vite
- **Security**: Proper isolation between processes

## � Development Notes

- **Single Command**: `npm run go` handles everything
- **Auto-install**: Dependencies install automatically if missing
- **Hot Reload**: Both TypeScript compilation and Electron refresh automatically
- **Error Handling**: TypeScript catches errors before runtime
- **Production Ready**: Full build pipeline for distribution

## 📋 Migration Status

### ✅ Completed:
- Full TypeScript conversion with comprehensive types
- Vite integration with hot reload
- Electron desktop app with native features
- Single command development workflow
- Production build pipeline

### 🎯 Architecture:
- **Class-based**: Clean OOP design with proper encapsulation
- **Type-safe**: Every function and data structure properly typed
- **Modern**: ES2020+ features with proper polyfills
- **Maintainable**: Clear separation of concerns

This setup provides a professional-grade development environment for the isometric tile editor with the full power of TypeScript, modern tooling, and native desktop integration.
