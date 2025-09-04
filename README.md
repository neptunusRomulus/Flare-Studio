# Advanced Flare Map Editor (TypeScript + React + Electron)

**Professional isometric tile map editor** built with modern web technologies for generating **Flare / Tiled TMX** compatible maps. Features a modern UI with TypeScript safety, React components, Tailwind CSS styling, and Electron desktop app integration.

## 🚀 Tech Stack

- **TypeScript** - Type safety and enhanced developer experience
- **React** - Component-based UI architecture  
- **Tailwind CSS** - Modern utility-first styling
- **shadcn/ui** - Beautiful, accessible UI components
- **Vite** - Fast development server and build tool
- **Electron** - Cross-platform desktop application
- **ESLint** - Code quality and consistency

## ✨ Features

### Core Tile Editing:
- PNG tileset loading & slicing (fixed 64x32 isometric tiles)
- Multiple tile layers (create, reorder, rename, toggle visibility)
- Professional layer management system
- Left click paint, right click erase (tile tool)
- Real-time preview with isometric rendering

### Collision System:
- Collision tool with visual overlay
- Exported as `<layer name="Collision">` in TMX

### Object Management:
- Object placement tool for doors, NPCs, events, obstacles
- Drag to move, resize with handles
- Properties editor with key/value pairs
- Type-safe object system
- Exported in `<objectgroup name="Objects">`

### Modern UI:
- Professional dark theme interface
- Responsive layout with sidebar panels
- Beautiful icons from Lucide React
- Modern buttons, inputs, and dropdowns
- Mini-map preview with real-time updates

### Export System:
- TMX (`map.tmx`) with all layers, collision, and objects
- TSX (`tileset.tsx`) with Base64 embedded tilesets
- Flare-compatible TXT format
- Undo/Redo system with state management

## 📁 Project Structure
```
src/
├── components/ui/          # shadcn/ui component library
│   ├── button.tsx         # Button component
│   ├── input.tsx          # Input component  
│   └── select.tsx         # Select component
├── editor/                # Core editor logic
│   └── TileMapEditor.ts   # Main editor class
├── lib/
│   └── utils.ts           # Utility functions
├── App.tsx                # Main React application
├── main.tsx               # React entry point
├── index.css              # Tailwind CSS + custom styles
└── types.ts               # TypeScript type definitions

electron/
└── main.cjs               # Electron main process

index.html                 # HTML entry point
vite.config.js            # Vite configuration
tailwind.config.js        # Tailwind CSS configuration
tsconfig.json             # TypeScript configuration
```

## 🛠️ Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation & Running
```bash
# Install dependencies
npm install

# Start development server with Electron
npm run go

# Build for production  
npm run build

# Run linting
npm run lint
```

### Windows Quick Start
```bash
# Use provided batch file
start.bat
```

## 🎮 How To Use

1. **Launch Application**: Run `npm run go` or use `start.bat`
2. **Load Tileset**: Click "Tileset PNG" to load your tileset image
3. **Create Layers**: Use the layer panel to manage tile layers
4. **Paint Tiles**: Select tiles from palette, paint with left click
5. **Add Collision**: Switch to collision tool to mark blocking areas
6. **Place Objects**: Use object tool to add interactive elements
7. **Configure Properties**: Select objects to edit their properties
8. **Adjust Map Size**: Use width/height inputs to resize canvas
9. **Export Files**: Generate TMX, TSX, or Flare TXT formats

## 📤 Export Formats

### TMX Format (Tiled Compatible)
```xml
<map orientation="orthogonal" tilewidth="64" tileheight="32" width="20" height="15">
  <tileset firstgid="1" name="main" tilewidth="64" tileheight="32" source="tileset.tsx"/>
  <layer name="Base">
    <data encoding="csv">1,2,3,...</data>
  </layer>
  <layer name="Collision">
    <data encoding="csv">0,1,0,...</data>  
  </layer>
  <objectgroup name="Objects">
    <object id="1" type="door" x="128" y="64" width="64" height="32">
      <properties>
        <property name="target" value="next_map"/>
      </properties>
    </object>
  </objectgroup>
</map>
```

## 🔧 Development Features

- **Hot Reload**: Instant updates during development
- **Type Safety**: Full TypeScript coverage with strict mode
- **Code Quality**: ESLint rules for consistent code style
- **Modern Build**: Optimized production builds with Vite
- **Cross Platform**: Runs on Windows, macOS, and Linux via Electron

## 🚀 Future Enhancements

- Advanced autotiling systems
- Multiple tileset support
- TMX import functionality  
- Advanced object shapes (polygons, circles)
- Brush patterns and flood fill
- Camera panning for large maps
- Plugin system for extensibility
- Collaborative editing features

## 🤝 Contributing

This project uses modern development practices:
- TypeScript for type safety
- ESLint for code quality
- React for UI components
- Tailwind for styling

All contributions should maintain these standards and include proper type definitions.

## 📜 License

Open source project - check license file for details.

---

**Built with modern web technologies for professional game development workflows.**
- Empty tile = 0 in CSV data.
- Collision layer uses 0/1 values (0 passable, 1 blocked).
- Mini map is approximate (samples each tile's center pixel).
- TSX uses embedded Base64; replace with relative `source="tileset.png"` for large assets.
- No compression; Tiled supports base64+gzip/zlib if needed.

## License
Public Domain / Unlicense. Do whatever you want. Attribution appreciated but not required.
