import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Undo2, Redo2, Plus, ChevronUp, ChevronDown, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square } from 'lucide-react';
import { Tool } from './types';
import { TileMapEditor } from './editor/TileMapEditor';

function App() {
  const [editor, setEditor] = useState<TileMapEditor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapWidth, setMapWidth] = useState(20);
  const [mapHeight, setMapHeight] = useState(15);
  const [tool, setTool] = useState<Tool>('tiles');
  const [objectType, setObjectType] = useState('event');
  const [activeGid] = useState('(none)'); // Removed unused setter
  const [hoverInfo] = useState('Hover: -'); // Removed unused setter
  const [showMinimap, setShowMinimap] = useState(true);

  useEffect(() => {
    if (canvasRef.current) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      setEditor(tileEditor);
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'extraTileset' | 'importTMX' | 'importTSX') => {
    const file = event.target.files?.[0];
    if (file && editor?.handleFileUpload) {
      editor.handleFileUpload(file, type);
    }
  };

  const handleToolChange = (newTool: string) => {
    setTool(newTool as Tool);
    if (editor?.setTool) {
      editor.setTool(newTool as Tool);
    }
  };

  const handleMapResize = () => {
    if (editor?.resizeMap) {
      editor.resizeMap(mapWidth, mapHeight);
    }
  };

  const handleZoomIn = () => {
    if (editor?.zoomIn) {
      editor.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (editor?.zoomOut) {
      editor.zoomOut();
    }
  };

  const handleResetZoom = () => {
    if (editor?.resetZoom) {
      editor.resetZoom();
    }
  };

  const handleExportMap = () => {
    if (editor?.exportFlareMap) {
      editor.exportFlareMap();
    }
  };

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    } else {
      console.log('Minimize clicked - Electron API not available');
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      console.log('Maximize clicked - Electron API not available');
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      console.log('Close clicked - Electron API not available');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Custom Title Bar */}
      <div className="bg-gray-800 text-white flex justify-between items-center px-4 py-1 select-none drag-region">
        <div className="text-sm font-medium">Flare Map Editor</div>
        <div className="flex no-drag">
          <button 
            onClick={handleMinimize}
            className="hover:bg-gray-600 p-1 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="hover:bg-gray-600 p-1 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="hover:bg-red-600 p-1 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="border-b p-4 flex-shrink-0">
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
            onClick={() => editor?.clearLayer?.()}
            title="Clear all tile data on active layer / collision when selected"
          >
            Clear Layer
          </Button>

          <Button onClick={handleExportMap} title="Export Flare map.txt and tileset definition">
            <Download className="w-4 h-4 mr-2" />
            Export Map
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.undo?.()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </Button>

          <Button 
            variant="outline" 
            onClick={() => editor?.redo?.()}
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
      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 border-r bg-muted/30 p-4 overflow-y-auto">
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
        <section className="flex-1 min-w-0 flex flex-col relative">
          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleResetZoom}
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant={showMinimap ? "default" : "outline"}
              className="w-8 h-8 p-0"
              onClick={handleToggleMinimap}
              title="Toggle Minimap"
            >
              <Map className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="bg-gray-100 flex-1 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              id="mapCanvas"
              className="tile-canvas w-full h-full"
            />
          </div>
          <div className="text-sm text-muted-foreground p-2 flex-shrink-0" id="hoverInfo">{hoverInfo}</div>
        </section>
      </main>
    </div>
  );
}

export default App;
