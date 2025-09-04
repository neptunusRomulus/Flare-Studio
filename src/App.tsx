import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Undo2, Redo2, Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
// Temporary - commenting out TileMapEditor until we fix it
// import { TileMapEditor } from './editor/TileMapEditor';

function App() {
  // const [editor, setEditor] = useState<TileMapEditor | null>(null);
  const [editor, setEditor] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const [mapWidth, setMapWidth] = useState(20);
  const [mapHeight, setMapHeight] = useState(15);
  const [tool, setTool] = useState('tiles');
  const [objectType, setObjectType] = useState('event');
  const [activeGid, setActiveGid] = useState('(none)');
  const [hoverInfo, setHoverInfo] = useState('Hover: -');

  useEffect(() => {
    if (canvasRef.current && miniMapRef.current) {
      // Temporary placeholder - we'll uncomment when TileMapEditor is fixed
      // const tileEditor = new TileMapEditor(canvasRef.current, miniMapRef.current);
      // setEditor(tileEditor);
      console.log('Canvas elements ready');
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'extraTileset' | 'importTMX' | 'importTSX') => {
    const file = event.target.files?.[0];
    if (file && editor) {
      editor.handleFileUpload(file, type);
    }
  };

  const handleToolChange = (newTool: string) => {
    setTool(newTool);
    if (editor) {
      editor.setTool(newTool as any);
    }
  };

  const handleMapResize = () => {
    if (editor) {
      editor.resizeMap(mapWidth, mapHeight);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold mb-2">Advanced Flare Map Editor</h1>
        <p className="text-muted-foreground mb-4">Isometric tile editor with 64x32 tiles.</p>
        
        {/* Controls Row 1 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative">
              <Upload className="w-4 h-4 mr-2" />
              Tileset PNG
              <input
                type="file"
                accept="image/png"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e, 'tileset')}
              />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative">
              <Upload className="w-4 h-4 mr-2" />
              Extra Tileset
              <input
                type="file"
                accept="image/png"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e, 'extraTileset')}
              />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Width:</label>
            <Input
              type="number"
              value={mapWidth}
              onChange={(e) => setMapWidth(Number(e.target.value))}
              min="1"
              className="w-16"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Height:</label>
            <Input
              type="number"
              value={mapHeight}
              onChange={(e) => setMapHeight(Number(e.target.value))}
              min="1"
              className="w-16"
            />
          </div>

          <Button onClick={handleMapResize} title="Resize map (keeps existing data within bounds)">
            Resize
          </Button>

          <Button 
            variant="destructive" 
            onClick={() => editor?.clearLayer()}
            title="Clear all tile data on active layer / collision when selected"
          >
            Clear Layer
          </Button>

          <Button onClick={() => editor?.exportTMX()}>
            <Download className="w-4 h-4 mr-2" />
            Export TMX
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.exportTSX()}
            title="Export tileset.tsx (Base64)"
          >
            Export TSX
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.exportFlareTXT()}
            title="Export map.txt in Flare format"
          >
            Export Flare TXT
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4 mr-2" />
            Redo
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative">
              <Upload className="w-4 h-4 mr-2" />
              Import TMX
              <input
                type="file"
                accept="text/xml,.tmx"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e, 'importTMX')}
              />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative">
              <Upload className="w-4 h-4 mr-2" />
              Import TSX
              <input
                type="file"
                accept="text/xml,.tsx"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e, 'importTSX')}
              />
            </Button>
          </div>
        </div>

        {/* Controls Row 2 - Tools */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Tool:</span>
          
          <div className="flex gap-2">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="tool"
                value="tiles"
                checked={tool === 'tiles'}
                onChange={(e) => handleToolChange(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">Tiles</span>
            </label>

            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="tool"
                value="collision"
                checked={tool === 'collision'}
                onChange={(e) => handleToolChange(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">Collision</span>
            </label>

            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="tool"
                value="objects"
                checked={tool === 'objects'}
                onChange={(e) => handleToolChange(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">Objects</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Object Type:</label>
            <Select value={objectType} onValueChange={setObjectType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">event (door)</SelectItem>
                <SelectItem value="npc">npc</SelectItem>
                <SelectItem value="spawn">spawn</SelectItem>
                <SelectItem value="obstacle">obstacle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-80 border-r bg-muted/30 p-4">
          {/* Tileset Section */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Tileset</h2>
            <div id="tilesetMeta" className="text-sm text-muted-foreground mb-2"></div>
            <div id="tilesContainer" className="tile-palette"></div>
            <p className="text-xs text-muted-foreground mt-2">Click tile to select brush. Right click canvas = erase.</p>
            <p className="text-xs text-muted-foreground">Active GID: <span id="activeGid">{activeGid}</span></p>
          </section>

          {/* Layers Section */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Layers</h2>
            <div id="layersList" className="mb-3"></div>
            <div className="flex gap-2 mb-2">
              <Button size="sm" title="Add new tile layer">
                <Plus className="w-4 h-4 mr-1" />
                Layer
              </Button>
              <Button size="sm" variant="outline" title="Move layer up">
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" title="Move layer down">
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="destructive" title="Delete layer">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">Collision & Objects managed separately.</div>
          </section>
        </aside>

        {/* Center Area */}
        <section className="flex-1 p-4">
          <div className="border rounded-lg bg-gray-100 inline-block">
            <canvas
              ref={canvasRef}
              id="mapCanvas"
              width="640"
              height="480"
              className="tile-canvas"
            />
          </div>
          <div className="text-sm text-muted-foreground mt-2" id="hoverInfo">{hoverInfo}</div>
        </section>

        {/* Right Sidebar */}
        <aside className="w-80 border-l bg-muted/30 p-4">
          {/* Object Inspector */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Object Inspector</h2>
            <div id="objectList" className="mb-3"></div>
            <div id="selectedObjectInfo" className="text-sm text-muted-foreground mb-4">No object selected.</div>
            <h3 className="text-md font-medium mb-2">Properties</h3>
            <form id="propertiesForm" className="mb-2"></form>
            <Button size="sm" type="button">Add Property</Button>
          </section>

          {/* Mini Map */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Mini Map</h2>
            <div className="border rounded bg-white">
              <canvas
                ref={miniMapRef}
                id="miniMapCanvas"
                width="200"
                height="200"
                className="block"
              />
            </div>
          </section>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t p-4 text-center">
        <small className="text-muted-foreground">
          Generated TMX targets Flare-compatible orthogonal maps. TypeScript + Vite + Electron.
        </small>
      </footer>
    </div>
  );
}

export default App;
