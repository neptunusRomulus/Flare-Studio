import {
  TileLayer,
  TilesetInfo,
  MapObject,
  Tool,
  Orientation
} from '../types';

export class TileMapEditor {
  private ctx!: CanvasRenderingContext2D;
  private miniCtx!: CanvasRenderingContext2D;
  private mapCanvas: HTMLCanvasElement;
  private miniMapCanvas: HTMLCanvasElement;

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

  // Tool and interaction state
  private tool: Tool = 'tiles';
  private activeGid: number = 0;
  private isMouseDown: boolean = false;

  // Hover state
  private hoverX: number = -1;
  private hoverY: number = -1;

  constructor(mapCanvas: HTMLCanvasElement, miniMapCanvas: HTMLCanvasElement) {
    this.mapCanvas = mapCanvas;
    this.miniMapCanvas = miniMapCanvas;
    this.initializeCanvas();
    this.initializeState();
    this.bindEvents();
    this.createDefaultLayers();
    this.draw();
  }

  private initializeCanvas(): void {
    const ctx = this.mapCanvas.getContext('2d');
    const miniCtx = this.miniMapCanvas.getContext('2d');
    
    if (!ctx || !miniCtx) {
      throw new Error('Unable to get canvas contexts');
    }

    this.ctx = ctx;
    this.miniCtx = miniCtx;

    // Set up canvas properties
    this.ctx.imageSmoothingEnabled = false;
    this.miniCtx.imageSmoothingEnabled = false;
  }

  private initializeState(): void {
    // Initialize collision data
    this.collisionData = new Array(this.mapWidth * this.mapHeight).fill(0);
  }

  private bindEvents(): void {
    // Mouse events for the main canvas
    this.mapCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.mapCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.mapCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private createDefaultLayers(): void {
    this.tileLayers = [
      {
        id: 1,
        name: 'Base',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true
      },
      {
        id: 2,
        name: 'Objects',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true
      }
    ];
    this.activeLayerId = 1;
    this.nextLayerId = 3;
  }

  private handleMouseDown(event: MouseEvent): void {
    this.isMouseDown = true;
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert screen coordinates to tile coordinates
    const tileCoords = this.screenToTile(x, y);
    if (tileCoords) {
      this.handleTileClick(tileCoords.x, tileCoords.y, event.button === 2);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const tileCoords = this.screenToTile(x, y);
    if (tileCoords) {
      this.hoverX = tileCoords.x;
      this.hoverY = tileCoords.y;
      
      if (this.isMouseDown) {
        this.handleTileClick(tileCoords.x, tileCoords.y, false);
      }
    }
    
    this.draw();
  }

  private handleMouseUp(): void {
    this.isMouseDown = false;
  }

  private screenToTile(screenX: number, screenY: number): { x: number, y: number } | null {
    // Convert screen coordinates to isometric tile coordinates
    // This is a simplified implementation
    const x = Math.floor(screenX / this.tileSizeX);
    const y = Math.floor(screenY / this.tileSizeY);
    
    if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
      return { x, y };
    }
    
    return null;
  }

  private handleTileClick(x: number, y: number, isRightClick: boolean): void {
    if (this.tool === 'tiles' && this.activeLayerId !== null) {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        const index = y * this.mapWidth + x;
        layer.data[index] = isRightClick ? 0 : this.activeGid;
      }
    }
  }

  private draw(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw tiles
    this.drawTiles();
    
    // Draw hover
    if (this.hoverX >= 0 && this.hoverY >= 0) {
      this.drawHover();
    }
    
    // Update mini map
    this.drawMiniMap();
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1;
    
    for (let x = 0; x <= this.mapWidth; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.tileSizeX, 0);
      this.ctx.lineTo(x * this.tileSizeX, this.mapHeight * this.tileSizeY);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= this.mapHeight; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.tileSizeY);
      this.ctx.lineTo(this.mapWidth * this.tileSizeX, y * this.tileSizeY);
      this.ctx.stroke();
    }
  }

  private drawTiles(): void {
    if (!this.tilesetImage) return;
    
    for (const layer of this.tileLayers) {
      if (!layer.visible) continue;
      
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const gid = layer.data[index];
          
          if (gid > 0) {
            this.drawTile(x, y, gid);
          }
        }
      }
    }
  }

  private drawTile(x: number, y: number, gid: number): void {
    if (!this.tilesetImage || gid <= 0) return;
    
    const tileIndex = gid - 1;
    const sourceX = (tileIndex % this.tilesetColumns) * this.tileSizeX;
    const sourceY = Math.floor(tileIndex / this.tilesetColumns) * this.tileSizeY;
    
    const destX = x * this.tileSizeX;
    const destY = y * this.tileSizeY;
    
    this.ctx.drawImage(
      this.tilesetImage,
      sourceX, sourceY, this.tileSizeX, this.tileSizeY,
      destX, destY, this.tileSizeX, this.tileSizeY
    );
  }

  private drawHover(): void {
    this.ctx.strokeStyle = '#007acc';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      this.hoverX * this.tileSizeX,
      this.hoverY * this.tileSizeY,
      this.tileSizeX,
      this.tileSizeY
    );
  }

  private drawMiniMap(): void {
    // Simple mini map implementation
    this.miniCtx.clearRect(0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
    
    const scaleX = this.miniMapCanvas.width / (this.mapWidth * this.tileSizeX);
    const scaleY = this.miniMapCanvas.height / (this.mapHeight * this.tileSizeY);
    
    this.miniCtx.save();
    this.miniCtx.scale(scaleX, scaleY);
    
    // Draw a simplified version
    this.miniCtx.fillStyle = '#ddd';
    this.miniCtx.fillRect(0, 0, this.mapWidth * this.tileSizeX, this.mapHeight * this.tileSizeY);
    
    this.miniCtx.restore();
  }

  // Public methods for React to interact with
  public handleFileUpload(file: File, type: 'tileset' | 'extraTileset' | 'importTMX' | 'importTSX'): void {
    if (type === 'tileset' || type === 'extraTileset') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.tilesetImage = img;
          this.tilesetFileName = file.name;
          this.tilesetColumns = Math.floor(img.width / this.tileSizeX);
          this.tilesetRows = Math.floor(img.height / this.tileSizeY);
          this.tileCount = this.tilesetColumns * this.tilesetRows;
          this.createTilePalette();
          this.draw();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private createTilePalette(): void {
    const container = document.getElementById('tilesContainer');
    if (!container || !this.tilesetImage) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < this.tileCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = this.tileSizeX;
      canvas.height = this.tileSizeY;
      canvas.className = 'palette-tile';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sourceX = (i % this.tilesetColumns) * this.tileSizeX;
        const sourceY = Math.floor(i / this.tilesetColumns) * this.tileSizeY;
        
        ctx.drawImage(
          this.tilesetImage,
          sourceX, sourceY, this.tileSizeX, this.tileSizeY,
          0, 0, this.tileSizeX, this.tileSizeY
        );
      }
      
      canvas.addEventListener('click', () => {
        this.activeGid = i + 1;
        this.updateActiveTile();
      });
      
      container.appendChild(canvas);
    }
  }

  private updateActiveTile(): void {
    const activeGidSpan = document.getElementById('activeGid');
    if (activeGidSpan) {
      activeGidSpan.textContent = this.activeGid.toString();
    }
    
    // Update selected tile visual
    const tiles = document.querySelectorAll('.palette-tile');
    tiles.forEach(tile => tile.classList.remove('selected'));
    if (this.activeGid > 0) {
      const selectedTile = tiles[this.activeGid - 1];
      if (selectedTile) {
        selectedTile.classList.add('selected');
      }
    }
  }

  public setTool(tool: Tool): void {
    this.tool = tool;
  }

  public resizeMap(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Resize collision data
    this.collisionData = new Array(width * height).fill(0);
    
    // Resize layer data
    for (const layer of this.tileLayers) {
      const newData = new Array(width * height).fill(0);
      for (let y = 0; y < Math.min(height, this.mapHeight); y++) {
        for (let x = 0; x < Math.min(width, this.mapWidth); x++) {
          const oldIndex = y * this.mapWidth + x;
          const newIndex = y * width + x;
          if (oldIndex < layer.data.length) {
            newData[newIndex] = layer.data[oldIndex];
          }
        }
      }
      layer.data = newData;
    }
    
    this.draw();
  }

  public clearLayer(): void {
    if (this.tool === 'tiles' && this.activeLayerId !== null) {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        layer.data.fill(0);
      }
    } else if (this.tool === 'collision') {
      this.collisionData.fill(0);
    }
    this.draw();
  }

  public exportTMX(): void {
    // Placeholder implementation
    console.log('Export TMX functionality to be implemented');
  }

  public exportTSX(): void {
    // Placeholder implementation
    console.log('Export TSX functionality to be implemented');
  }

  public exportFlareTXT(): void {
    // Placeholder implementation
    console.log('Export Flare TXT functionality to be implemented');
  }

  public undo(): void {
    // Placeholder implementation
    console.log('Undo functionality to be implemented');
  }

  public redo(): void {
    // Placeholder implementation
    console.log('Redo functionality to be implemented');
  }
}
