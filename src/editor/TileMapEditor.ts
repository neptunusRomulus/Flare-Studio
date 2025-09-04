import {
  TileLayer,
  TilesetInfo,
  MapObject,
  Tool,
  Orientation
} from '../types';

export class TileMapEditor {
  private ctx!: CanvasRenderingContext2D;
  private mapCanvas: HTMLCanvasElement;
  private showMinimap: boolean = true;

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

  // Zoom and pan state
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;
  private spacePressed: boolean = false;

  constructor(mapCanvas: HTMLCanvasElement) {
    this.mapCanvas = mapCanvas;
    this.initializeCanvas();
    this.initializeState();
    this.bindEvents();
    this.createDefaultLayers();
    this.draw();
  }

  private initializeCanvas(): void {
    const ctx = this.mapCanvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Unable to get canvas context');
    }

    this.ctx = ctx;

    // Set up canvas properties
    this.ctx.imageSmoothingEnabled = false;
    
    // Set canvas dimensions to fill the available container
    this.resizeCanvas();
    
    // Listen for window resize to adjust canvas size
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const container = this.mapCanvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.mapCanvas.width = rect.width;
      this.mapCanvas.height = rect.height;
      
      // Redraw after resize
      this.draw();
    }
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
    
    // Zoom events
    this.mapCanvas.addEventListener('wheel', this.handleWheel.bind(this));
    
    // Keyboard events for panning (need to be on document for spacebar)
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Focus the canvas to receive keyboard events
    this.mapCanvas.tabIndex = 0;
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
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (this.spacePressed) {
      // Start panning
      this.isPanning = true;
      this.lastPanX = x;
      this.lastPanY = y;
      this.mapCanvas.style.cursor = 'grabbing';
    } else {
      // Normal tile editing
      this.isMouseDown = true;
      const tileCoords = this.screenToTile(x, y);
      if (tileCoords) {
        this.handleTileClick(tileCoords.x, tileCoords.y, event.button === 2);
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isPanning && this.spacePressed) {
      // Handle panning
      const deltaX = x - this.lastPanX;
      const deltaY = y - this.lastPanY;
      this.setPan(deltaX, deltaY);
      this.lastPanX = x;
      this.lastPanY = y;
    } else {
      // Normal hover and tile editing
      const tileCoords = this.screenToTile(x, y);
      if (tileCoords) {
        this.hoverX = tileCoords.x;
        this.hoverY = tileCoords.y;
        
        if (this.isMouseDown && !this.spacePressed) {
          this.handleTileClick(tileCoords.x, tileCoords.y, false);
        }
      }
    }
    
    this.draw();
  }

  private handleMouseUp(): void {
    this.isMouseDown = false;
    this.isPanning = false;
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * zoomFactor);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.spacePressed = true;
      this.mapCanvas.style.cursor = 'grab';
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.spacePressed = false;
      this.mapCanvas.style.cursor = 'crosshair';
    }
  }

  private screenToTile(screenX: number, screenY: number): { x: number, y: number } | null {
    // Use the isometric screen-to-map conversion
    const mapCoords = this.screenToMap(screenX, screenY);
    
    if (mapCoords.x >= 0 && mapCoords.x < this.mapWidth && mapCoords.y >= 0 && mapCoords.y < this.mapHeight) {
      return { x: mapCoords.x, y: mapCoords.y };
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
    
    // Save context state
    this.ctx.save();
    
    // Apply zoom and pan transformations to the drawing context
    // Note: We don't apply transformations here since they're already applied in mapToScreen()
    
    // Draw grid
    this.drawGrid();
    
    // Draw tiles
    this.drawTiles();
    
    // Draw hover
    if (this.hoverX >= 0 && this.hoverY >= 0) {
      this.drawHover();
    }
    
    // Restore context state
    this.ctx.restore();
    
    // Update mini map (not affected by zoom/pan)
    this.drawMiniMap();
  }

  // Coordinate transformation methods for isometric rendering with zoom and pan
  private mapToScreen(mapX: number, mapY: number): { x: number, y: number } {
    const screenX = (mapX - mapY) * (this.tileSizeX / 2);
    const screenY = (mapX + mapY) * (this.tileSizeY / 2);
    
    // Apply zoom and pan transformations
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    
    return {
      x: (screenX + offsetX) * this.zoom,
      y: (screenY + offsetY) * this.zoom
    };
  }

  private screenToMap(screenX: number, screenY: number): { x: number, y: number } {
    // Apply inverse zoom and pan transformations
    const zoomedX = screenX / this.zoom;
    const zoomedY = screenY / this.zoom;
    
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    const adjustedX = zoomedX - offsetX;
    const adjustedY = zoomedY - offsetY;
    
    // Convert to map coordinates
    const mapX = (adjustedX / (this.tileSizeX / 2) + adjustedY / (this.tileSizeY / 2)) / 2;
    const mapY = (adjustedY / (this.tileSizeY / 2) - adjustedX / (this.tileSizeX / 2)) / 2;
    
    return {
      x: Math.floor(mapX),
      y: Math.floor(mapY)
    };
  }

  // Zoom and pan methods
  public setZoom(newZoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, newZoom)); // Clamp between 0.1x and 5x
    this.draw();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public zoomIn(): void {
    this.setZoom(this.zoom * 1.2);
  }

  public zoomOut(): void {
    this.setZoom(this.zoom / 1.2);
  }

  public resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
  }

  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    this.draw();
  }

  public setPan(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
    this.draw();
  }

  // Public method to trigger canvas resize
  public resizeCanvasToContainer(): void {
    this.resizeCanvas();
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1 / this.zoom; // Scale line width inversely with zoom
    
    // Draw diamond-shaped grid cells for isometric view
    for (let mapY = 0; mapY < this.mapHeight; mapY++) {
      for (let mapX = 0; mapX < this.mapWidth; mapX++) {
        const screenPos = this.mapToScreen(mapX, mapY);
        const halfTileX = (this.tileSizeX / 2) * this.zoom;
        const halfTileY = (this.tileSizeY / 2) * this.zoom;
        
        // Draw diamond outline for each cell
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
      }
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
    
    // Use isometric screen coordinates with zoom applied
    const screenPos = this.mapToScreen(x, y);
    const scaledTileX = this.tileSizeX * this.zoom;
    const scaledTileY = this.tileSizeY * this.zoom;
    const destX = screenPos.x - scaledTileX / 2;
    const destY = screenPos.y - scaledTileY / 2;
    
    this.ctx.drawImage(
      this.tilesetImage,
      sourceX, sourceY, this.tileSizeX, this.tileSizeY,
      destX, destY, scaledTileX, scaledTileY
    );
  }

  private drawHover(): void {
    this.ctx.strokeStyle = '#007acc';
    this.ctx.lineWidth = 2 / this.zoom; // Scale line width inversely with zoom
    
    // Draw isometric diamond outline for hover - same as grid cell
    const screenPos = this.mapToScreen(this.hoverX, this.hoverY);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawMiniMap(): void {
    if (!this.showMinimap) return;
    
    // Minimap dimensions and position (bottom-right corner)
    const minimapWidth = 150;
    const minimapHeight = 120;
    const padding = 10;
    const x = this.mapCanvas.width - minimapWidth - padding;
    const y = this.mapCanvas.height - minimapHeight - padding;
    
    // Save current context state
    this.ctx.save();
    
    // Draw minimap background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(x - 5, y - 5, minimapWidth + 10, minimapHeight + 10);
    
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(x, y, minimapWidth, minimapHeight);
    
    // Draw border
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, minimapWidth, minimapHeight);
    
    // Calculate orthogonal scale for minimap (not isometric)
    const orthogonalTileWidth = 8; // Small tile size for minimap
    const orthogonalTileHeight = 8;
    const scaleX = minimapWidth / (this.mapWidth * orthogonalTileWidth);
    const scaleY = minimapHeight / (this.mapHeight * orthogonalTileHeight);
    const scale = Math.min(scaleX, scaleY);
    
    // Center the map within the minimap
    const mapPixelWidth = this.mapWidth * orthogonalTileWidth * scale;
    const mapPixelHeight = this.mapHeight * orthogonalTileHeight * scale;
    const offsetX = x + (minimapWidth - mapPixelWidth) / 2;
    const offsetY = y + (minimapHeight - mapPixelHeight) / 2;
    
    // Draw tiles in orthogonal view
    for (let layerIndex = 0; layerIndex < this.tileLayers.length; layerIndex++) {
      const layer = this.tileLayers[layerIndex];
      if (!layer.visible) continue;
      
      for (let tileY = 0; tileY < this.mapHeight; tileY++) {
        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
          const index = tileY * this.mapWidth + tileX;
          const gid = layer.data[index];
          
          if (gid > 0) {
            const pixelX = offsetX + tileX * orthogonalTileWidth * scale;
            const pixelY = offsetY + tileY * orthogonalTileHeight * scale;
            
            // Draw a simple colored rectangle for each tile
            this.ctx.fillStyle = `hsl(${(gid * 137.5) % 360}, 50%, 50%)`;
            this.ctx.fillRect(pixelX, pixelY, orthogonalTileWidth * scale, orthogonalTileHeight * scale);
          }
        }
      }
    }
    
    // Draw viewport indicator (current view area)
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 2;
    
    // Calculate current viewport in map coordinates
    const viewLeft = -this.panX / this.zoom;
    const viewTop = -this.panY / this.zoom;
    const viewWidth = this.mapCanvas.width / this.zoom;
    const viewHeight = this.mapCanvas.height / this.zoom;
    
    // Convert to minimap coordinates
    const viewX = offsetX + (viewLeft / (this.mapWidth * orthogonalTileWidth)) * mapPixelWidth;
    const viewY = offsetY + (viewTop / (this.mapHeight * orthogonalTileHeight)) * mapPixelHeight;
    const viewW = (viewWidth / (this.mapWidth * orthogonalTileWidth)) * mapPixelWidth;
    const viewH = (viewHeight / (this.mapHeight * orthogonalTileHeight)) * mapPixelHeight;
    
    this.ctx.strokeRect(viewX, viewY, viewW, viewH);
    
    // Restore context state
    this.ctx.restore();
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

  // Flare export system
  public exportFlareMap(): void {
    if (!this.tilesetImage || !this.tilesetFileName) {
      alert('Please load a tileset first before exporting.');
      return;
    }

    // Generate both the map TXT and tilesetdefs.txt
    const mapTxt = this.generateFlareMapTxt();
    const tilesetDef = this.generateFlareTilesetDef();

    // Create and download map.txt
    this.downloadFile(mapTxt, 'map.txt', 'text/plain');
    
    // Create and download tilesetdefs/tileset.txt
    this.downloadFile(tilesetDef, 'tileset.txt', 'text/plain');
    
    console.log('Flare map and tileset definition exported successfully!');
  }

  private generateFlareMapTxt(): string {
    const lines: string[] = [];
    
    // Header information
    lines.push(`# Flare Map`);
    lines.push(`width=${this.mapWidth}`);
    lines.push(`height=${this.mapHeight}`);
    lines.push(`tilewidth=${this.tileSizeX}`);
    lines.push(`tileheight=${this.tileSizeY}`);
    lines.push(`tileset=tileset.txt`);
    lines.push('');
    
    // Export each visible layer
    for (const layer of this.tileLayers) {
      if (!layer.visible) continue;
      
      lines.push(`[layer]`);
      lines.push(`type=background`);
      lines.push(`data=`);
      
      // Export tile data in comma-separated format
      for (let y = 0; y < this.mapHeight; y++) {
        const row: string[] = [];
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          row.push(layer.data[index].toString());
        }
        lines.push(row.join(','));
      }
      lines.push('');
    }
    
    // Export collision layer if it has data
    const hasCollision = this.collisionData.some(cell => cell !== 0);
    if (hasCollision) {
      lines.push(`[layer]`);
      lines.push(`type=collision`);
      lines.push(`data=`);
      
      for (let y = 0; y < this.mapHeight; y++) {
        const row: string[] = [];
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          row.push(this.collisionData[index].toString());
        }
        lines.push(row.join(','));
      }
    }
    
    return lines.join('\n');
  }

  private generateFlareTilesetDef(): string {
    if (!this.tilesetFileName) return '';
    
    const lines: string[] = [];
    
    // Image reference
    lines.push(`img=../maps/${this.tilesetFileName}`);
    lines.push('');
    
    // Generate tile definitions
    for (let i = 0; i < this.tileCount; i++) {
      const id = i + 1; // Start from 1
      const left_x = (i % this.tilesetColumns) * this.tileSizeX;
      const top_y = Math.floor(i / this.tilesetColumns) * this.tileSizeY;
      const width = this.tileSizeX;
      const height = this.tileSizeY;
      const offset_x = this.tileSizeX / 2;
      const offset_y = this.tileSizeY / 2;
      
      lines.push(`tile=${id},${left_x},${top_y},${width},${height},${offset_x},${offset_y}`);
    }
    
    return lines.join('\n');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
