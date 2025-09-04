// Advanced Flare Map Editor - Complete TypeScript Version
// Entry point for the Vite + Electron application

import {
  TileLayer,
  TilesetInfo,
  MapObject,
  ExportTMXParams,
  ExportTSXParams,
  ExportFlareTXTParams,
  FlareEvent,
  FlareNPC,
  UndoRedoState,
  Tool,
  Orientation
} from './types.js';

// Main application class
export class TileMapEditor {
  // DOM Elements
  private elements!: {
    tilesetFileInput: HTMLInputElement;
    extraTilesetFileInput: HTMLInputElement;
    tilesContainer: HTMLDivElement;
    activeGidSpan: HTMLSpanElement;
    mapCanvas: HTMLCanvasElement;
    hoverInfo: HTMLDivElement;
    mapWidthInput: HTMLInputElement;
    mapHeightInput: HTMLInputElement;
    resizeMapBtn: HTMLButtonElement;
    clearMapBtn: HTMLButtonElement;
    exportTMXBtn: HTMLButtonElement;
    exportTSXBtn: HTMLButtonElement;
    exportFlareTXTBtn: HTMLButtonElement;
    undoBtn: HTMLButtonElement;
    redoBtn: HTMLButtonElement;
    importTMXFile: HTMLInputElement;
    importTSXFile: HTMLInputElement;
    layersListEl: HTMLDivElement;
    newLayerNameInput: HTMLInputElement;
    addLayerBtn: HTMLButtonElement;
    objectListEl: HTMLDivElement;
    selectedObjectInfo: HTMLDivElement;
    propertiesForm: HTMLFormElement;
    addPropertyBtn: HTMLButtonElement;
    miniMapCanvas: HTMLCanvasElement;
  };

  private ctx!: CanvasRenderingContext2D;
  private miniCtx!: CanvasRenderingContext2D;

  // State variables
  private mapWidth: number = 20;
  private mapHeight: number = 15;
  private readonly tileSizeX: number = 64;
  private readonly tileSizeY: number = 32;
  private readonly orientation: Orientation = 'isometric';

  // Tileset management
  private tilesets: TilesetInfo[] = [];
  private tilesetImage: HTMLImageElement | null = null;
  private tilesetFileName: string | null = null;
  private tilesetColumns: number = 0;
  private tilesetRows: number = 0;
  private tileCount: number = 0;

  // Layer management
  private tileLayers: TileLayer[] = [];
  private activeLayerId: number | null = null;
  private nextLayerId: number = 1;

  // Collision and object management
  private collisionData: number[] = [];
  private objects: MapObject[] = [];
  private nextObjectId: number = 1;
  private selectedObjectId: number | null = null;
  private draggingObject: MapObject | null = null;

  // Tool and interaction state
  private tool: Tool = 'tiles';
  private activeGid: number = 0;
  private isMouseDown: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  // Hover state
  private hoverX: number = -1;
  private hoverY: number = -1;

  // Undo/Redo system
  private undoStack: UndoRedoState[] = [];
  private redoStack: UndoRedoState[] = [];
  private readonly maxUndoStates: number = 50;

  constructor() {
    this.initializeDOM();
    this.initializeCanvas();
    this.initializeState();
    this.bindEvents();
    this.createDefaultLayers();
    this.updateExportButtonStates();
    this.draw();
  }

  private initializeDOM(): void {
    this.elements = {
      tilesetFileInput: this.getElement('tilesetFile') as HTMLInputElement,
      extraTilesetFileInput: this.getElement('extraTilesetFile') as HTMLInputElement,
      tilesContainer: this.getElement('tilesContainer') as HTMLDivElement,
      activeGidSpan: this.getElement('activeGid') as HTMLSpanElement,
      mapCanvas: this.getElement('mapCanvas') as HTMLCanvasElement,
      hoverInfo: this.getElement('hoverInfo') as HTMLDivElement,
      mapWidthInput: this.getElement('mapWidthInput') as HTMLInputElement,
      mapHeightInput: this.getElement('mapHeightInput') as HTMLInputElement,
      resizeMapBtn: this.getElement('resizeMapBtn') as HTMLButtonElement,
      clearMapBtn: this.getElement('clearMapBtn') as HTMLButtonElement,
      exportTMXBtn: this.getElement('exportTMXBtn') as HTMLButtonElement,
      exportTSXBtn: this.getElement('exportTSXBtn') as HTMLButtonElement,
      exportFlareTXTBtn: this.getElement('exportFlareTXTBtn') as HTMLButtonElement,
      undoBtn: this.getElement('undoBtn') as HTMLButtonElement,
      redoBtn: this.getElement('redoBtn') as HTMLButtonElement,
      importTMXFile: this.getElement('importTMXFile') as HTMLInputElement,
      importTSXFile: this.getElement('importTSXFile') as HTMLInputElement,
      layersListEl: this.getElement('layersList') as HTMLDivElement,
      newLayerNameInput: this.getElement('newLayerName') as HTMLInputElement,
      addLayerBtn: this.getElement('addLayerBtn') as HTMLButtonElement,
      objectListEl: this.getElement('objectList') as HTMLDivElement,
      selectedObjectInfo: this.getElement('selectedObjectInfo') as HTMLDivElement,
      propertiesForm: this.getElement('propertiesForm') as HTMLFormElement,
      addPropertyBtn: this.getElement('addPropertyBtn') as HTMLButtonElement,
      miniMapCanvas: this.getElement('miniMapCanvas') as HTMLCanvasElement
    };
  }

  private getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  }

  private initializeCanvas(): void {
    const ctx = this.elements.mapCanvas.getContext('2d');
    const miniCtx = this.elements.miniMapCanvas.getContext('2d');
    
    if (!ctx || !miniCtx) {
      throw new Error('Unable to get canvas contexts');
    }
    
    this.ctx = ctx;
    this.miniCtx = miniCtx;
  }

  private initializeState(): void {
    this.mapWidth = parseInt(this.elements.mapWidthInput.value, 10);
    this.mapHeight = parseInt(this.elements.mapHeightInput.value, 10);
    this.collisionData = new Array(this.mapWidth * this.mapHeight).fill(0);
    this.resizeMapCanvas();
  }

  private createDefaultLayers(): void {
    this.createLayer('Ground');
    this.createLayer('Wall');
    this.createLayer('Decor');
    this.activeLayerId = this.tileLayers[0]?.id || null;
    this.refreshLayersUI();
  }

  private createLayer(name: string): void {
    const layer: TileLayer = {
      id: this.nextLayerId++,
      name,
      data: new Array(this.mapWidth * this.mapHeight).fill(0),
      visible: true
    };
    this.tileLayers.push(layer);
  }

  // Canvas utilities
  private resizeMapCanvas(): void {
    const isoWidth = (this.mapWidth + this.mapHeight) * this.tileSizeX / 2;
    const isoHeight = (this.mapWidth + this.mapHeight) * this.tileSizeY / 2 + this.tileSizeY;
    
    this.elements.mapCanvas.width = Math.max(800, isoWidth + 100);
    this.elements.mapCanvas.height = Math.max(600, isoHeight + 100);
    
    this.draw();
    this.drawMiniMap();
  }

  private screenToMapCoords(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.elements.mapCanvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    const centerX = this.elements.mapCanvas.width / 2;
    const centerY = this.tileSizeY * 2;
    
    const relX = canvasX - centerX;
    const relY = canvasY - centerY;
    
    const mapX = Math.floor((relX / (this.tileSizeX / 2) + relY / (this.tileSizeY / 2)) / 2);
    const mapY = Math.floor((relY / (this.tileSizeY / 2) - relX / (this.tileSizeX / 2)) / 2);
    
    return { x: mapX, y: mapY };
  }

  // Drawing functions
  private draw(): void {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.elements.mapCanvas.width, this.elements.mapCanvas.height);

    // Draw tile layers
    this.tileLayers.forEach(layer => {
      if (!layer.visible) return;
      this.drawLayer(layer);
    });

    // Draw collision overlay if collision tool is active
    if (this.tool === 'collision') {
      this.drawCollisionOverlay();
    }

    // Draw grid, objects, and hover effect
    this.drawGrid();
    this.drawObjects();
    this.drawHoverEffect();
  }

  private drawLayer(layer: TileLayer): void {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        const gid = layer.data[index];
        if (!gid) continue;

        // Find appropriate tileset for this GID
        let tileset: TilesetInfo | undefined;
        for (let i = this.tilesets.length - 1; i >= 0; i--) {
          if (gid >= this.tilesets[i]!.firstgid) {
            tileset = this.tilesets[i];
            break;
          }
        }
        
        if (!tileset) continue;
        
        const tileIndex = gid - tileset.firstgid;
        const srcX = (tileIndex % tileset.columns) * this.tileSizeX;
        const srcY = Math.floor(tileIndex / tileset.columns) * this.tileSizeY;

        // Isometric rendering
        const screenX = this.elements.mapCanvas.width / 2 + (x - y) * this.tileSizeX / 2;
        const screenY = this.tileSizeY * 2 + (x + y) * this.tileSizeY / 2;

        this.ctx.drawImage(
          tileset.image,
          srcX, srcY, this.tileSizeX, this.tileSizeY,
          screenX - this.tileSizeX / 2, screenY - this.tileSizeY, this.tileSizeX, this.tileSizeY
        );
      }
    }
  }

  private drawCollisionOverlay(): void {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        if (!this.collisionData[index]) continue;

        const screenX = this.elements.mapCanvas.width / 2 + (x - y) * this.tileSizeX / 2;
        const screenY = this.tileSizeY * 2 + (x + y) * this.tileSizeY / 2;

        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, screenY - this.tileSizeY / 2);
        this.ctx.lineTo(screenX + this.tileSizeX / 2, screenY);
        this.ctx.lineTo(screenX, screenY + this.tileSizeY / 2);
        this.ctx.lineTo(screenX - this.tileSizeX / 2, screenY);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= this.mapWidth; x++) {
      for (let y = 0; y <= this.mapHeight; y++) {
        const screenX = this.elements.mapCanvas.width / 2 + (x - y) * this.tileSizeX / 2;
        const screenY = this.tileSizeY * 2 + (x + y) * this.tileSizeY / 2;

        // Horizontal grid lines
        if (x < this.mapWidth) {
          const nextScreenX = this.elements.mapCanvas.width / 2 + ((x + 1) - y) * this.tileSizeX / 2;
          const nextScreenY = this.tileSizeY * 2 + ((x + 1) + y) * this.tileSizeY / 2;
          
          this.ctx.beginPath();
          this.ctx.moveTo(screenX, screenY);
          this.ctx.lineTo(nextScreenX, nextScreenY);
          this.ctx.stroke();
        }

        // Vertical grid lines
        if (y < this.mapHeight) {
          const nextScreenX = this.elements.mapCanvas.width / 2 + (x - (y + 1)) * this.tileSizeX / 2;
          const nextScreenY = this.tileSizeY * 2 + (x + (y + 1)) * this.tileSizeY / 2;
          
          this.ctx.beginPath();
          this.ctx.moveTo(screenX, screenY);
          this.ctx.lineTo(nextScreenX, nextScreenY);
          this.ctx.stroke();
        }
      }
    }
  }

  private drawObjects(): void {
    this.objects.forEach(obj => {
      const isSelected = obj.id === this.selectedObjectId;
      
      this.ctx.strokeStyle = isSelected ? '#ff0' : '#0f0';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      
      if (isSelected) {
        // Draw resize handles
        const handleSize = 6;
        this.ctx.fillStyle = '#ff0';
        this.ctx.fillRect(obj.x - handleSize/2, obj.y - handleSize/2, handleSize, handleSize);
        this.ctx.fillRect(obj.x + obj.width - handleSize/2, obj.y - handleSize/2, handleSize, handleSize);
        this.ctx.fillRect(obj.x - handleSize/2, obj.y + obj.height - handleSize/2, handleSize, handleSize);
        this.ctx.fillRect(obj.x + obj.width - handleSize/2, obj.y + obj.height - handleSize/2, handleSize, handleSize);
      }
    });
  }

  private drawHoverEffect(): void {
    if (this.hoverX < 0 || this.hoverX >= this.mapWidth || this.hoverY < 0 || this.hoverY >= this.mapHeight) return;

    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;

    const screenX = this.elements.mapCanvas.width / 2 + (this.hoverX - this.hoverY) * this.tileSizeX / 2;
    const screenY = this.tileSizeY * 2 + (this.hoverX + this.hoverY) * this.tileSizeY / 2;

    this.ctx.beginPath();
    this.ctx.moveTo(screenX, screenY - this.tileSizeY / 2);
    this.ctx.lineTo(screenX + this.tileSizeX / 2, screenY);
    this.ctx.lineTo(screenX, screenY + this.tileSizeY / 2);
    this.ctx.lineTo(screenX - this.tileSizeX / 2, screenY);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawMiniMap(): void {
    this.miniCtx.fillStyle = '#000';
    this.miniCtx.fillRect(0, 0, this.elements.miniMapCanvas.width, this.elements.miniMapCanvas.height);
    
    // Simple minimap representation
    const scaleX = this.elements.miniMapCanvas.width / this.mapWidth;
    const scaleY = this.elements.miniMapCanvas.height / this.mapHeight;
    
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        let hasTile = false;
        
        // Check if any layer has a tile here
        for (const layer of this.tileLayers) {
          if (layer.visible && layer.data[index] > 0) {
            hasTile = true;
            break;
          }
        }
        
        if (hasTile) {
          this.miniCtx.fillStyle = '#4a4a4a';
          this.miniCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
        }
      }
    }
  }

  // Event binding and handlers
  private bindEvents(): void {
    this.bindCanvasEvents();
    this.bindUIEvents();
    this.bindToolEvents();
  }

  private bindCanvasEvents(): void {
    this.elements.mapCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.elements.mapCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.elements.mapCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.elements.mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private bindUIEvents(): void {
    this.elements.resizeMapBtn.addEventListener('click', () => this.onResizeMap());
    this.elements.clearMapBtn.addEventListener('click', () => this.onClearMap());
    this.elements.exportTMXBtn.addEventListener('click', () => this.exportTMX());
    this.elements.exportTSXBtn.addEventListener('click', () => this.exportTSX());
    this.elements.exportFlareTXTBtn.addEventListener('click', () => this.exportFlareTXT());
    this.elements.tilesetFileInput.addEventListener('change', (e) => this.onTilesetFileChange(e));
  }

  private bindToolEvents(): void {
    const toolRadios = document.querySelectorAll('input[name="tool"]') as NodeListOf<HTMLInputElement>;
    toolRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.tool = radio.value as Tool;
        this.draw();
      });
    });
  }

  // Event handlers
  private onMouseMove(e: MouseEvent): void {
    const coords = this.screenToMapCoords(e.clientX, e.clientY);
    this.hoverX = coords.x;
    this.hoverY = coords.y;
    
    this.elements.hoverInfo.textContent = `Hover: ${coords.x}, ${coords.y}`;
    this.draw();
  }

  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    const coords = this.screenToMapCoords(e.clientX, e.clientY);
    
    if (this.tool === 'tiles') {
      this.placeTile(coords.x, coords.y);
    } else if (this.tool === 'collision') {
      this.toggleCollision(coords.x, coords.y);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    this.isMouseDown = false;
  }

  private onResizeMap(): void {
    const newW = parseInt(this.elements.mapWidthInput.value, 10) || this.mapWidth;
    const newH = parseInt(this.elements.mapHeightInput.value, 10) || this.mapHeight;
    this.resizeMap(newW, newH);
  }

  private onClearMap(): void {
    if (confirm('Clear active layer / collision?')) {
      this.clearActiveLayer();
    }
  }

  private onTilesetFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    this.tilesetFileName = file.name;
    
    const img = new Image();
    img.onload = () => {
      this.tilesetImage = img;
      this.tilesetColumns = Math.floor(img.width / this.tileSizeX);
      this.tilesetRows = Math.floor(img.height / this.tileSizeY);
      this.tileCount = this.tilesetColumns * this.tilesetRows;
      
      // Rebuild tilesets array
      const extras = this.tilesets.filter(t => t.name !== 'main');
      let firstgidCursor = 1 + this.tileCount;
      extras.forEach(ex => { 
        ex.firstgid = firstgidCursor; 
        firstgidCursor += ex.tileCount; 
      });
      
      this.tilesets = [{
        name: 'main',
        image: img,
        columns: this.tilesetColumns,
        rows: this.tilesetRows,
        tileCount: this.tileCount,
        firstgid: 1
      }, ...extras];
      
      this.buildTilesetButtons();
      this.draw();
      this.updateExportButtonStates();
    };
    
    img.onerror = () => alert('Failed to load image. Ensure it is a valid PNG.');
    img.src = URL.createObjectURL(file);
  }

  // Core functionality
  private placeTile(x: number, y: number): void {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;
    if (!this.activeLayerId) return;
    
    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;
    
    const index = y * this.mapWidth + x;
    layer.data[index] = this.activeGid;
    
    this.draw();
    this.drawMiniMap();
  }

  private toggleCollision(x: number, y: number): void {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;
    
    const index = y * this.mapWidth + x;
    this.collisionData[index] = this.collisionData[index] ? 0 : 1;
    
    this.draw();
  }

  private resizeMap(newW: number, newH: number): void {
    const copyLayer = (oldArr: number[]): number[] => {
      const arr = new Array(newW * newH).fill(0);
      for (let y = 0; y < Math.min(this.mapHeight, newH); y++) {
        for (let x = 0; x < Math.min(this.mapWidth, newW); x++) {
          arr[y * newW + x] = oldArr[y * this.mapWidth + x];
        }
      }
      return arr;
    };
    
    this.tileLayers.forEach(l => { l.data = copyLayer(l.data); });
    this.collisionData = copyLayer(this.collisionData);
    this.mapWidth = newW;
    this.mapHeight = newH;
    this.resizeMapCanvas();
    this.updateExportButtonStates();
  }

  private clearActiveLayer(): void {
    if (!this.activeLayerId) return;
    
    if (this.tool === 'collision') {
      this.collisionData.fill(0);
    } else {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        layer.data.fill(0);
      }
    }
    
    this.draw();
    this.drawMiniMap();
  }

  private buildTilesetButtons(): void {
    this.elements.tilesContainer.innerHTML = '';
    
    if (!this.tilesetImage) return;
    
    for (let i = 0; i < this.tileCount; i++) {
      const button = document.createElement('button');
      button.className = 'tile-btn';
      button.dataset.gid = String(i + 1);
      
      const canvas = document.createElement('canvas');
      canvas.width = this.tileSizeX;
      canvas.height = this.tileSizeY;
      const ctx = canvas.getContext('2d')!;
      
      const srcX = (i % this.tilesetColumns) * this.tileSizeX;
      const srcY = Math.floor(i / this.tilesetColumns) * this.tileSizeY;
      
      ctx.drawImage(
        this.tilesetImage,
        srcX, srcY, this.tileSizeX, this.tileSizeY,
        0, 0, this.tileSizeX, this.tileSizeY
      );
      
      button.appendChild(canvas);
      button.addEventListener('click', () => {
        this.setActiveGid(i + 1);
      });
      
      this.elements.tilesContainer.appendChild(button);
    }
  }

  private setActiveGid(gid: number): void {
    this.activeGid = gid;
    this.elements.activeGidSpan.textContent = String(gid);
    
    // Update tile button selection
    const buttons = this.elements.tilesContainer.querySelectorAll('.tile-btn') as NodeListOf<HTMLButtonElement>;
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gid === String(gid));
    });
  }

  private refreshLayersUI(): void {
    this.elements.layersListEl.innerHTML = '';
    
    this.tileLayers.forEach(layer => {
      const div = document.createElement('div');
      div.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.visible;
      checkbox.addEventListener('change', () => {
        layer.visible = checkbox.checked;
        this.draw();
      });
      
      const label = document.createElement('span');
      label.textContent = layer.name;
      label.addEventListener('click', () => {
        this.activeLayerId = layer.id;
        this.refreshLayersUI();
      });
      
      div.appendChild(checkbox);
      div.appendChild(label);
      this.elements.layersListEl.appendChild(div);
    });
  }

  // Export functions
  private exportTMX(): void {
    if (this.mapWidth <= 0 || this.mapHeight <= 0) {
      alert('Map must have valid width and height');
      return;
    }
    
    if (!this.tileLayers || this.tileLayers.length === 0) {
      alert('Map must have at least one layer');
      return;
    }
    
    const builtInLayers = this.getBuiltInLayers();
    
    const xml = this.exportAsTMX({
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      tileWidth: this.tileSizeX,
      tileHeight: this.tileSizeY,
      layers: builtInLayers,
      tilesetRef: null
    });
    
    this.downloadStringAsFile('map.tmx', xml);
  }

  private exportTSX(): void {
    if (!this.tilesetImage) {
      alert('Load a tileset first.');
      return;
    }
    
    if (!this.tilesetFileName) {
      alert('No tileset filename available.');
      return;
    }
    
    let imageSourceName = this.tilesetFileName;
    if (!imageSourceName.toLowerCase().endsWith('.png')) {
      imageSourceName = imageSourceName.replace(/\.[^.]*$/, '') + '.png';
    }
    
    const tsx = this.exportAsTSX({
      tileWidth: this.tileSizeX,
      tileHeight: this.tileSizeY,
      imageWidth: this.tilesetImage.width,
      imageHeight: this.tilesetImage.height,
      tilesetPngName: imageSourceName
    });
    
    this.downloadStringAsFile('tileset.tsx', tsx);
  }

  private exportFlareTXT(): void {
    if (this.mapWidth <= 0 || this.mapHeight <= 0) {
      alert('Map must have valid width and height');
      return;
    }
    
    if (!this.tileLayers || this.tileLayers.length === 0) {
      alert('Map must have at least one layer');
      return;
    }
    
    const builtInLayers = this.getBuiltInLayers();
    const hasCollisionData = this.collisionData && this.collisionData.some(val => val !== 0);
    
    // Prepare events and NPCs from objects
    const events: FlareEvent[] = [];
    const npcs: FlareNPC[] = [];
    
    this.objects.forEach(obj => {
      if (obj.type === 'event' || (obj.properties && obj.properties.type === 'event')) {
        events.push({
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          targetMap: (obj.properties && obj.properties.map) || 'othermap.txt'
        });
      } else if (obj.type === 'npc' || (obj.properties && obj.properties.type === 'npc')) {
        npcs.push({
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          filename: (obj.properties && obj.properties.filename) || 'npcs/name.txt'
        });
      }
    });
    
    const flareTXT = this.exportAsFlareTXT({
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      tileWidth: this.tileSizeX,
      tileHeight: this.tileSizeY,
      layers: builtInLayers,
      collisionLayer: hasCollisionData ? this.collisionData : null,
      tilesets: this.tilesets && this.tilesets.length > 0 ? this.tilesets : null,
      events: events.length > 0 ? events : null,
      npcs: npcs.length > 0 ? npcs : null,
      heroPos: '1,1',
      music: 'none',
      title: 'GeneratedMap'
    });
    
    this.downloadStringAsFile('map.txt', flareTXT);
  }

  // Export utility functions
  private exportAsTMX(params: ExportTMXParams): string {
    const header = `<?xml version="1.0" encoding="UTF-8"?>`;
    const mapOpen = `<map version="1.0" orientation="orthogonal" renderorder="right-down" width="${params.mapWidth}" height="${params.mapHeight}" tilewidth="${params.tileWidth}" tileheight="${params.tileHeight}" infinite="0">`;
    
    const tilesetTag = `  <tileset firstgid="1" source="tileset.tsx"/>`;
    
    let layersXML = '';
    params.layers.forEach(layer => {
      const csvData = this.layerToCSV(layer.data);
      layersXML += `  <layer name="${layer.name}" width="${params.mapWidth}" height="${params.mapHeight}">
    <data encoding="csv">
${csvData}
    </data>
  </layer>
`;
    });
    
    const objectsXML = this.buildObjectsXML();
    const mapClose = `</map>`;
    
    const parts = [header, mapOpen, tilesetTag, layersXML.trim()];
    if (objectsXML) parts.push(objectsXML);
    parts.push(mapClose);
    
    return parts.join('\n');
  }

  private exportAsTSX(params: ExportTSXParams): string {
    const columns = Math.floor(params.imageWidth / params.tileWidth);
    const rows = Math.floor(params.imageHeight / params.tileHeight);
    const tileCount = columns * rows;
    
    const header = `<?xml version="1.0" encoding="UTF-8"?>`;
    const tilesetTag = `<tileset name="main" tilewidth="${params.tileWidth}" tileheight="${params.tileHeight}" tilecount="${tileCount}" columns="${columns}">`;
    const imageTag = `  <image source="${params.tilesetPngName}" width="${params.imageWidth}" height="${params.imageHeight}"/>`;
    const tilesetClose = `</tileset>`;
    
    return [header, tilesetTag, imageTag, tilesetClose].join('\n');
  }

  private exportAsFlareTXT(params: ExportFlareTXTParams): string {
    let output = '';
    
    // [header] section
    output += '[header]\n';
    output += `width=${params.mapWidth}\n`;
    output += `height=${params.mapHeight}\n`;
    output += `tilewidth=${params.tileWidth}\n`;
    output += `tileheight=${params.tileHeight}\n`;
    output += 'orientation=isometric\n';
    output += 'background_color=0,0,0,255\n';
    output += `hero_pos=${params.heroPos || '1,1'}\n`;
    output += `music=${params.music || 'none'}\n`;
    
    if (params.tilesets && params.tilesets.length > 0 && this.tilesetFileName) {
      output += `tileset=tilesetdefs/tileset.txt\n`;
    }
    
    output += `title=${params.title || 'GeneratedMap'}\n`;
    output += '\n';
    
    // [tilesets] section
    if (params.tilesets && params.tilesets.length > 0) {
      output += '[tilesets]\n';
      params.tilesets.forEach(tileset => {
        const filename = tileset.name === 'main' ? (this.tilesetFileName || 'tileset.png') : `${tileset.name}.png`;
        output += `tileset=${filename},${params.tileWidth},${params.tileHeight},0,0\n`;
      });
      output += '\n';
    }
    
    // [layer] sections
    if (params.layers && params.layers.length > 0) {
      params.layers.forEach(layer => {
        output += '[layer]\n';
        output += `type=${layer.name.toLowerCase()}\n`;
        output += 'data=\n';
        
        for (let y = 0; y < params.mapHeight; y++) {
          let row = '';
          for (let x = 0; x < params.mapWidth; x++) {
            const index = y * params.mapWidth + x;
            const tileId = layer.data[index];
            row += tileId || 0;
            if (x < params.mapWidth - 1) row += ',';
          }
          row += ',';
          output += row + '\n';
        }
        output += '\n';
      });
    }
    
    // Collision layer
    if (params.collisionLayer && params.collisionLayer.some(val => val !== 0)) {
      output += '[layer]\n';
      output += 'type=collision\n';
      output += 'data=\n';
      
      for (let y = 0; y < params.mapHeight; y++) {
        let row = '';
        for (let x = 0; x < params.mapWidth; x++) {
          const index = y * params.mapWidth + x;
          const collisionValue = params.collisionLayer[index];
          row += collisionValue || 0;
          if (x < params.mapWidth - 1) row += ',';
        }
        row += ',';
        output += row + '\n';
      }
      output += '\n';
    }
    
    // Events and NPCs
    if (params.events && params.events.length > 0) {
      params.events.forEach(event => {
        output += '[event]\n';
        output += 'type=event\n';
        output += `location=${event.x},${event.y},${event.width},${event.height}\n`;
        output += 'activate=on_trigger\n';
        output += `map=${event.targetMap || 'othermap.txt'}\n`;
        output += '\n';
      });
    }
    
    if (params.npcs && params.npcs.length > 0) {
      params.npcs.forEach(npc => {
        output += '[npc]\n';
        output += 'type=npc\n';
        output += `location=${npc.x},${npc.y},${npc.width},${npc.height}\n`;
        output += `filename=${npc.filename || 'npcs/name.txt'}\n`;
        output += '\n';
      });
    }
    
    return output;
  }

  // Utility functions
  private layerToCSV(layerData: number[]): string {
    let csvData = '';
    for (let y = 0; y < this.mapHeight; y++) {
      let row = '';
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        const gid = layerData[index];
        row += gid;
        if (x < this.mapWidth - 1) row += ',';
      }
      csvData += row;
      if (y < this.mapHeight - 1) csvData += '\n';
    }
    return csvData;
  }

  private getBuiltInLayers(): TileLayer[] {
    const layerNames = ['Ground', 'Wall', 'Decor'];
    const orderedLayers: TileLayer[] = [];
    
    layerNames.forEach(name => {
      let layer = this.tileLayers.find(l => l.name === name);
      if (!layer) {
        layer = {
          id: this.nextLayerId++,
          name: name,
          data: new Array(this.mapWidth * this.mapHeight).fill(0),
          visible: true
        };
        this.tileLayers.push(layer);
      }
      orderedLayers.push(layer);
    });
    
    return orderedLayers;
  }

  private buildObjectsXML(): string {
    if (!this.objects.length) return '';
    
    const lines = ['  <objectgroup name="Objects">'];
    this.objects.forEach(o => {
      let objLine = `    <object id="${o.id}" name="${this.escapeXML(o.name || '')}" type="${this.escapeXML(o.type || '')}" x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"`;
      const propKeys = Object.keys(o.properties || {});
      if (!propKeys.length) {
        objLine += '/>';
        lines.push(objLine);
      } else {
        objLine += '>';
        lines.push(objLine);
        lines.push('      <properties>');
        propKeys.forEach(k => {
          lines.push(`        <property name="${this.escapeXML(k)}" value="${this.escapeXML(o.properties[k] || '')}" />`);
        });
        lines.push('      </properties>');
        lines.push('    </object>');
      }
    });
    lines.push('  </objectgroup>');
    
    return lines.join('\n');
  }

  private escapeXML(str: string): string {
    return String(str).replace(/[<>&"']/g, c => {
      const map: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;'
      };
      return map[c] || c;
    });
  }

  private downloadStringAsFile(filename: string, text: string): void {
    const blob = new Blob([text], { 
      type: filename.endsWith('.tmx') || filename.endsWith('.tsx') ? 'application/xml' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private updateExportButtonStates(): void {
    // TSX export validation
    if (!this.tilesetImage || !this.tilesetFileName) {
      this.elements.exportTSXBtn.disabled = true;
      this.elements.exportTSXBtn.title = 'Load a tileset PNG first';
    } else {
      this.elements.exportTSXBtn.disabled = false;
      this.elements.exportTSXBtn.title = 'Export tileset.tsx';
    }
    
    // TMX export validation
    const hasValidMapSize = this.mapWidth > 0 && this.mapHeight > 0;
    const hasLayers = this.tileLayers && this.tileLayers.length > 0;
    
    if (!hasValidMapSize || !hasLayers) {
      this.elements.exportTMXBtn.disabled = true;
      this.elements.exportTMXBtn.title = 'Map must have valid size and at least one layer';
      this.elements.exportFlareTXTBtn.disabled = true;
      this.elements.exportFlareTXTBtn.title = 'Map must have valid size and at least one layer';
    } else {
      this.elements.exportTMXBtn.disabled = false;
      this.elements.exportTMXBtn.title = 'Export map.tmx';
      this.elements.exportFlareTXTBtn.disabled = false;
      this.elements.exportFlareTXTBtn.title = 'Export map.txt in Flare format';
    }
  }
}

// Initialize the application
const editor = new TileMapEditor();

// Export for global access if needed
(window as any).tileMapEditor = editor;
