// Advanced Flare Map Editor
// Enhancements over minimal version:
// 1. Multiple tile layers (create, reorder, visibility, deletion)
// 2. Collision layer (boolean grid) painted with collision tool
// 3. Object layer (place, select, drag, resize basic rectangles + properties)
// 4. Property editor for selected object (key/value arbitrary)
// 5. Mini-map preview (auto-updated on changes)
// 6. TMX export includes all <layer> (tile + collision) and <objectgroup>
//    Uses CSV encoding for tile layers and properties for objects.
// Still plain JS, no frameworks.

(function() {
  // Remove orientation and tile size selections - fixed to isometric with 64x32 tiles
  const tilesetFileInput = document.getElementById('tilesetFile');
  const extraTilesetFileInput = document.getElementById('extraTilesetFile');
  const tilesContainer = document.getElementById('tilesContainer');
  const activeGidSpan = document.getElementById('activeGid');
  const mapCanvas = document.getElementById('mapCanvas');
  const hoverInfo = document.getElementById('hoverInfo');
  const mapWidthInput = document.getElementById('mapWidthInput');
  const mapHeightInput = document.getElementById('mapHeightInput');
  const resizeMapBtn = document.getElementById('resizeMapBtn');
  const clearMapBtn = document.getElementById('clearMapBtn');
  const exportTMXBtn = document.getElementById('exportTMXBtn');
  const exportTSXBtn = document.getElementById('exportTSXBtn');
  const exportFlareTXTBtn = document.getElementById('exportFlareTXTBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const importTMXFile = document.getElementById('importTMXFile');
  const importTSXFile = document.getElementById('importTSXFile');
  const tilesetMeta = document.getElementById('tilesetMeta');
  const toolBar = document.getElementById('toolBar');
  const objectTypeSelect = document.getElementById('objectTypeSelect');
  const layersList = document.getElementById('layersList');
  const addLayerBtn = document.getElementById('addLayerBtn');
  const layerUpBtn = document.getElementById('layerUpBtn');
  const layerDownBtn = document.getElementById('layerDownBtn');
  const delLayerBtn = document.getElementById('delLayerBtn');
  const objectListEl = document.getElementById('objectList');
  const selectedObjectInfo = document.getElementById('selectedObjectInfo');
  const propertiesForm = document.getElementById('propertiesForm');
  const addPropertyBtn = document.getElementById('addPropertyBtn');
  const miniMapCanvas = document.getElementById('miniMapCanvas');
  const miniCtx = miniMapCanvas.getContext('2d');

  const ctx = mapCanvas.getContext('2d');

  // State
  let mapWidth = parseInt(mapWidthInput.value, 10); // tiles
  let mapHeight = parseInt(mapHeightInput.value, 10); // tiles
  let tileSizeX = 64; // Fixed tile width for isometric
  let tileSizeY = 32; // Fixed tile height for isometric
  let orientation = 'isometric'; // Fixed to isometric view
  // Multiple tilesets support: each entry { name, image, columns, rows, tileCount, firstgid }
  let tilesets = [];
  let tilesetImage = null; // primary tileset reference for backwards compatibility
  let tilesetFileName = null; // track original filename for TSX export
  let tilesetColumns = 0;  // primary columns
  let tilesetRows = 0;     // primary rows
  let tileCount = 0;       // primary tile count
  let activeGid = 0;       // selected tile for painting

  // Tools: 'tiles' | 'collision' | 'objects'
  let activeTool = 'tiles';

  // Tile Layers: array of objects { id, name, data (Uint32Array or Array), visible }
  let tileLayers = [];
  let activeLayerId = null; // id of currently selected tile layer
  let nextLayerId = 1;

  // Collision layer: separate boolean grid (0=passable,1=blocked)
  let collisionData = new Array(mapWidth * mapHeight).fill(0);
  let collisionVisible = true;

  // Object layer models: array of { id, name, type, x, y, width, height, properties: {k:v} }
  let objects = [];
  let nextObjectId = 1;
  let selectedObjectId = null;
  let draggingObject = null; // { id, offsetX, offsetY, mode: 'move'|'resize', startW, startH, originX, originY }
  // For object dragging we capture original rect
  
  // Hover state for painting preview
  let hoverTileX = -1;
  let hoverTileY = -1;
  // Undo/Redo stacks
  function pushAction(action){
    undoStack.push(action); if(undoStack.length>UNDO_LIMIT) undoStack.shift();
    redoStack.length=0; updateUndoUI();
  }
  function updateUndoUI(){ if(undoBtn) undoBtn.disabled=!undoStack.length; if(redoBtn) redoBtn.disabled=!redoStack.length; }
  function undo(){ const a=undoStack.pop(); if(!a) return; a.revert(); redoStack.push(a); updateUndoUI(); draw(); refreshObjectUI(); }
  function redo(){ const a=redoStack.pop(); if(!a) return; a.apply(); undoStack.push(a); updateUndoUI(); draw(); refreshObjectUI(); }

  // Undo/Redo stacks (simple action objects with apply/revert)
  const undoStack = [];
  const redoStack = [];
  const UNDO_LIMIT = 500;

  // Offscreen canvas used to extract tile images for preview & minimap rendering
  let offscreen = document.createElement('canvas');
  let offctx = offscreen.getContext('2d');

  // Adjust map canvas size to match current map dimensions
  function resizeMapCanvas() {
    if (orientation === 'isometric') {
      mapCanvas.width = (mapWidth + mapHeight) * tileSizeX / 2;
      mapCanvas.height = (mapWidth + mapHeight) * tileSizeY / 2;
    } else {
      mapCanvas.width = mapWidth * tileSizeX;
      mapCanvas.height = mapHeight * tileSizeY;
    }
    draw();
  }

  function index(x, y) { return y * mapWidth + x; }

  function createLayer(name) {
    const layer = {
      id: nextLayerId++,
      name: name || `Layer${nextLayerId - 1}`,
      data: new Array(mapWidth * mapHeight).fill(0),
      visible: true
    };
    tileLayers.push(layer);
    activeLayerId = layer.id;
    refreshLayersUI();
    draw();
  }

  function getActiveLayer() {
    return tileLayers.find(l => l.id === activeLayerId) || null;
  }

  function clearActiveLayer() {
    if (activeTool === 'collision') {
      collisionData.fill(0);
    } else {
      const layer = getActiveLayer();
      if (layer) layer.data.fill(0);
    }
    draw();
  }

  function resizeMap(newW, newH) {
    const copyLayer = (oldArr) => {
      const arr = new Array(newW * newH).fill(0);
      for (let y = 0; y < Math.min(mapHeight, newH); y++) {
        for (let x = 0; x < Math.min(mapWidth, newW); x++) {
          arr[y * newW + x] = oldArr[y * mapWidth + x];
        }
      }
      return arr;
    };
    tileLayers.forEach(l => { l.data = copyLayer(l.data); });
    collisionData = copyLayer(collisionData);
    mapWidth = newW; mapHeight = newH;
    resizeMapCanvas();
    draw();
    updateExportButtonStates(); // Update export button states when map dimensions change
  }

  // Draw grid and tiles
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    // Draw layers using the selected rendering mode
    tileLayers.forEach(layer => {
      if (!layer.visible) return;
      const data = layer.data;
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const gid = data[y * mapWidth + x];
          if (gid > 0) {
            let dx, dy;
            if (orientation === 'isometric') {
              // Isometric rendering: screenX = (x - y) * (tileWidth / 2), screenY = (x + y) * (tileHeight / 2)
              dx = (x - y) * tileSizeX / 2 + (mapHeight * tileSizeX / 2);
              dy = (x + y) * tileSizeY / 2;
            } else {
              // Orthogonal rendering: tiles at (x*tileWidth, y*tileHeight)
              dx = x * tileSizeX;
              dy = y * tileSizeY;
            }
            drawGID(gid, dx, dy);
          }
        }
      }
    });

    // Collision overlay
    if (collisionVisible) {
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          if (collisionData[y * mapWidth + x]) {
            let dx, dy;
            if (orientation === 'isometric') {
              dx = (x - y) * tileSizeX / 2 + (mapHeight * tileSizeX / 2);
              dy = (x + y) * tileSizeY / 2;
            } else {
              dx = x * tileSizeX;
              dy = y * tileSizeY;
            }
            ctx.fillRect(dx, dy, tileSizeX, tileSizeY);
          }
        }
      }
    }

    // Draw grid lines based on orientation
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    if (orientation === 'isometric') {
      // Draw diamond grid by drawing each tile's four edges, centered around tile position
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          let cx = (x - y) * tileSizeX / 2 + (mapHeight * tileSizeX / 2) + tileSizeX / 2;
          let cy = (x + y) * tileSizeY / 2 + tileSizeY / 2;
          // Four corners of the diamond centered around the tile
          let top = { x: cx, y: cy - tileSizeY / 2 };
          let right = { x: cx + tileSizeX / 2, y: cy };
          let bottom = { x: cx, y: cy + tileSizeY / 2 };
          let left = { x: cx - tileSizeX / 2, y: cy };
          // Draw the complete diamond
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(right.x, right.y);
          ctx.lineTo(bottom.x, bottom.y);
          ctx.lineTo(left.x, left.y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else {
      // Draw orthogonal grid lines (horizontal and vertical)
      for (let x = 0; x <= mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tileSizeX + 0.5, 0);
        ctx.lineTo(x * tileSizeX + 0.5, mapHeight * tileSizeY);
        ctx.stroke();
      }
      for (let y = 0; y <= mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tileSizeY + 0.5);
        ctx.lineTo(mapWidth * tileSizeX, y * tileSizeY + 0.5);
        ctx.stroke();
      }
    }

    // Draw hover effect for painting preview
    if (hoverTileX >= 0 && hoverTileY >= 0 && hoverTileX < mapWidth && hoverTileY < mapHeight && (activeTool === 'tiles' || activeTool === 'collision')) {
      let hx, hy;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      
      if (orientation === 'isometric') {
        hx = (hoverTileX - hoverTileY) * tileSizeX / 2 + (mapHeight * tileSizeX / 2) + tileSizeX / 2;
        hy = (hoverTileX + hoverTileY) * tileSizeY / 2 + tileSizeY / 2;
        
        // Draw diamond-shaped hover effect
        ctx.beginPath();
        ctx.moveTo(hx, hy - tileSizeY / 2); // top
        ctx.lineTo(hx + tileSizeX / 2, hy); // right
        ctx.lineTo(hx, hy + tileSizeY / 2); // bottom
        ctx.lineTo(hx - tileSizeX / 2, hy); // left
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw rectangular hover effect for orthogonal mode
        hx = hoverTileX * tileSizeX;
        hy = hoverTileY * tileSizeY;
        ctx.fillRect(hx, hy, tileSizeX, tileSizeY);
      }
    }

    // Objects (rectangles)
    ctx.lineWidth = 1;
    objects.forEach(obj => {
      const sel = obj.id === selectedObjectId;
      ctx.strokeStyle = sel ? '#4caf50' : '#ffff00';
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(obj.x, obj.y - 10, ctx.measureText(obj.name || obj.type).width + 4, 10);
      ctx.fillStyle = '#fff';
      ctx.fillText(obj.name || obj.type, obj.x + 2, obj.y - 2);
    });

    drawMiniMap();
  }

  function findTilesetForGID(gid) {
    for (let i = tilesets.length - 1; i >= 0; i--) {
      const ts = tilesets[i];
      if (gid >= ts.firstgid && gid < ts.firstgid + ts.tileCount) return ts;
    }
    return null;
  }

  function drawGID(gid, dx, dy) {
  const ts = findTilesetForGID(gid);
  if (!ts) return;
  const local = gid - ts.firstgid;
  const sx = (local % ts.columns) * tileSizeX;
  const sy = Math.floor(local / ts.columns) * tileSizeY;
  ctx.drawImage(ts.image, sx, sy, tileSizeX, tileSizeY, dx, dy, tileSizeX, tileSizeY);
  }

  function setActiveGid(gid) {
    activeGid = gid;
    activeGidSpan.textContent = gid.toString();
    document.querySelectorAll('.tileBtn').forEach(btn => {
      const g = parseInt(btn.dataset.gid, 10);
      btn.classList.toggle('selected', g === gid);
    });
  }

  // Build tile buttons from loaded image
  function buildTilesetButtons() {
    tilesContainer.innerHTML = '';
    if (!tilesetImage) return;

    tileSizeX = parseInt(tileSizeXSelect.value, 10);
    tileSizeY = parseInt(tileSizeYSelect.value, 10);
    tilesetColumns = Math.floor(tilesetImage.width / tileSizeX);
    tilesetRows = Math.floor(tilesetImage.height / tileSizeY);
    tileCount = tilesetColumns * tilesetRows;

    tilesetMeta.textContent = `Image: ${tilesetImage.width}x${tilesetImage.height}px | cols=${tilesetColumns} rows=${tilesetRows} count=${tileCount}`;

    offscreen.width = tileSizeX;
    offscreen.height = tileSizeY;

    for (let i = 0; i < tileCount; i++) {
      const col = i % tilesetColumns;
      const row = Math.floor(i / tilesetColumns);
      offctx.clearRect(0, 0, tileSizeX, tileSizeY);
      offctx.drawImage(tilesetImage, col * tileSizeX, row * tileSizeY, tileSizeX, tileSizeY, 0, 0, tileSizeX, tileSizeY);
      const dataURL = offscreen.toDataURL();

      const btn = document.createElement('button');
      btn.className = 'tileBtn';
      btn.dataset.gid = (i + 1).toString(); // TMX GIDs start at 1 for first tileset
      const img = document.createElement('img');
      img.src = dataURL;
      btn.appendChild(img);
      btn.title = `GID ${i + 1}`;
      btn.addEventListener('click', () => setActiveGid(i + 1));
      tilesContainer.appendChild(btn);
    }
  }

  // Export layer data as CSV (row-major). Tiled TMX expects trailing newline optional; we include newline for readability.
  function dataToCSV(arr) {
    let out = '';
    for (let y = 0; y < mapHeight; y++) {
      let row = '';
      for (let x = 0; x < mapWidth; x++) {
        row += arr[y * mapWidth + x];
        if (x < mapWidth - 1) row += ',';
      }
      out += row;
      if (y < mapHeight - 1) out += '\n';
    }
    return out;
  }

  // Robust TMX export for Flare-compatible maps
  // Always exports as orthogonal regardless of visual rendering mode
  // Now supports multiple layers: Ground, Wall, Decor
  function exportAsTMX({ mapWidth, mapHeight, tileWidth, tileHeight, layers, tilesetRef }) {
    const header = `<?xml version="1.0" encoding="UTF-8"?>`;
    const mapOpen = `<map version="1.0" orientation="orthogonal" renderorder="right-down" width="${mapWidth}" height="${mapHeight}" tilewidth="${tileWidth}" tileheight="${tileHeight}" infinite="0">`;
    
    // Use external tileset reference instead of inline definition
    const tilesetTag = `  <tileset firstgid="1" source="tileset.tsx"/>`;
    
    // Convert layer data to CSV format with GID mapping (0-based index -> GID)
    function layerToCSV(layerData) {
      let csvData = '';
      for (let y = 0; y < mapHeight; y++) {
        let row = '';
        for (let x = 0; x < mapWidth; x++) {
          const index = y * mapWidth + x;
          const tileIndex = Array.isArray(layerData[0]) ? layerData[y][x] : layerData[index];
          // Convert 0-based tile index to GID (0 = empty, index+1 = GID)
          const gid = tileIndex === 0 ? 0 : tileIndex;  // Use the GID as is since data is already in GID format
          row += gid;
          if (x < mapWidth - 1) row += ',';
        }
        csvData += row;
        if (y < mapHeight - 1) csvData += '\n';
      }
      return csvData;
    }
    
    // Generate layer XML for each provided layer
    let layersXML = '';
    layers.forEach(layer => {
      const csvData = layerToCSV(layer.data);
      layersXML += `  <layer name="${layer.name}" width="${mapWidth}" height="${mapHeight}">
    <data encoding="csv">
${csvData}
    </data>
  </layer>
`;
    });
    
    // Add objectgroup after layers (only if objects exist)
    const objectsXML = buildObjectsXML();
    
    const mapClose = `</map>`;
    
    const parts = [header, mapOpen, tilesetTag, layersXML.trim()];
    if (objectsXML) parts.push(objectsXML);
    parts.push(mapClose);
    
    return parts.join('\n');
  }

  // Helper function to get the three built-in layers in the correct order
  function getBuiltInLayers() {
    const layerNames = ['Ground', 'Wall', 'Decor'];
    const orderedLayers = [];
    
    layerNames.forEach(name => {
      let layer = tileLayers.find(l => l.name === name);
      if (!layer) {
        // Create missing built-in layer
        layer = {
          id: nextLayerId++,
          name: name,
          data: new Array(mapWidth * mapHeight).fill(0),
          visible: true
        };
        tileLayers.push(layer);
      }
      orderedLayers.push(layer);
    });
    
    return orderedLayers;
  }

  /*
  Example Multi-Layer TMX output with Objects:
  <?xml version="1.0" encoding="UTF-8"?>
  <map version="1.0" orientation="orthogonal" renderorder="right-down" width="10" height="8" tilewidth="32" tileheight="32" infinite="0">
    <tileset firstgid="1" source="tileset.tsx"/>
    <layer name="Ground" width="10" height="8">
      <data encoding="csv">
  0,0,0,0,0,0,0,0,0,0,
  0,1,2,3,0,0,0,0,0,0,
  0,4,5,6,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0
      </data>
    </layer>
    <layer name="Wall" width="10" height="8">
      <data encoding="csv">
  7,7,7,7,7,7,7,7,7,7,
  7,0,0,0,0,0,0,0,0,7,
  7,0,0,0,0,0,0,0,0,7,
  7,0,0,0,0,0,0,0,0,7,
  7,0,0,0,0,0,0,0,0,7,
  7,0,0,0,0,0,0,0,0,7,
  7,0,0,0,0,0,0,0,0,7,
  7,7,7,7,7,7,7,7,7,7
      </data>
    </layer>
    <layer name="Decor" width="10" height="8">
      <data encoding="csv">
  0,0,0,0,0,0,0,0,0,0,
  0,0,8,0,0,0,0,9,0,0,
  0,10,0,0,0,0,0,0,11,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0
      </data>
    </layer>
    <objectgroup name="Objects">
      <object id="1" name="main_door" type="event" x="128" y="32" width="32" height="32">
        <properties>
          <property name="map" value="town.tmx"/>
        </properties>
      </object>
      <object id="2" name="guard" type="npc" x="96" y="96" width="32" height="32">
        <properties>
          <property name="dialog" value="Welcome to our town!"/>
        </properties>
      </object>
      <object id="3" name="spawn_point" type="spawn" x="64" y="192" width="32" height="32"/>
      <object id="4" name="wall" type="obstacle" x="0" y="0" width="32" height="256"/>
    </objectgroup>
  </map>
  */

  // Export TSX tileset definition file
  function exportAsTSX({ tileWidth, tileHeight, imageWidth, imageHeight, tilesetPngName }) {
    // Compute tileset properties
    const columns = Math.floor(imageWidth / tileWidth);
    const rows = Math.floor(imageHeight / tileHeight);
    const tileCount = columns * rows;
    
    const header = `<?xml version="1.0" encoding="UTF-8"?>`;
    const tilesetTag = `<tileset name="main" tilewidth="${tileWidth}" tileheight="${tileHeight}" tilecount="${tileCount}" columns="${columns}">`;
    const imageTag = `  <image source="${tilesetPngName}" width="${imageWidth}" height="${imageHeight}"/>`;
    const tilesetClose = `</tileset>`;
    
    return [header, tilesetTag, imageTag, tilesetClose].join('\n');
  }

  /*
  Example TSX output:
  <?xml version="1.0" encoding="UTF-8"?>
  <tileset name="main" tilewidth="32" tileheight="32" tilecount="256" columns="16">
    <image source="tileset.png" width="512" height="512"/>
  </tileset>
  */

  // Export Flare TXT format - native Flare map format, not TMX
  function exportAsFlareTXT({ mapWidth, mapHeight, tileWidth, tileHeight, layers, collisionLayer, tilesets, events, npcs, heroPos, music, title }) {
    let output = '';
    
    // [header] section
    output += '[header]\n';
    output += `width=${mapWidth}\n`;
    output += `height=${mapHeight}\n`;
    output += `tilewidth=${tileWidth}\n`;
    output += `tileheight=${tileHeight}\n`;
    output += 'orientation=isometric\n'; // Flare expects isometric, even if editor stores orthogonal
    output += 'background_color=0,0,0,255\n';
    output += `hero_pos=${heroPos || '1,1'}\n`; // default (1,1)
    output += `music=${music || 'none'}\n`; // placeholder
    
    // Tileset reference - use tilesetdefs format or direct PNG reference
    const primaryTileset = tilesets && tilesets.length > 0 ? tilesets[0] : null;
    if (primaryTileset && tilesetFileName) {
      output += `tileset=tilesetdefs/tileset.txt\n`; // Standard Flare tileset reference
    }
    
    output += `title=${title || 'GeneratedMap'}\n`;
    output += '\n';
    
    // [tilesets] section
    if (tilesets && tilesets.length > 0) {
      output += '[tilesets]\n';
      tilesets.forEach(tileset => {
        const filename = tileset.name === 'main' ? (tilesetFileName || 'tileset.png') : `${tileset.name}.png`;
        output += `tileset=${filename},${tileWidth},${tileHeight},0,0\n`;
      });
      output += '\n';
    }
    
    // [layer] sections - one for each tile layer
    if (layers && layers.length > 0) {
      layers.forEach(layer => {
        output += '[layer]\n';
        output += `type=${layer.name.toLowerCase()}\n`;
        output += 'data=\n';
        
        // Convert layer data to CSV format (Flare TXT format)
        for (let y = 0; y < mapHeight; y++) {
          let row = '';
          for (let x = 0; x < mapWidth; x++) {
            const index = y * mapWidth + x;
            const tileId = Array.isArray(layer.data[0]) ? layer.data[y][x] : layer.data[index];
            row += tileId || 0; // 0 for empty
            if (x < mapWidth - 1) row += ',';
          }
          row += ','; // Each row ends with a comma in Flare format
          output += row + '\n';
        }
        output += '\n';
      });
    }
    
    // [layer] section for collision if exists
    if (collisionLayer && collisionLayer.some(val => val !== 0)) {
      output += '[layer]\n';
      output += 'type=collision\n';
      output += 'data=\n';
      
      for (let y = 0; y < mapHeight; y++) {
        let row = '';
        for (let x = 0; x < mapWidth; x++) {
          const index = y * mapWidth + x;
          const collisionValue = Array.isArray(collisionLayer[0]) ? collisionLayer[y][x] : collisionLayer[index];
          row += collisionValue || 0;
          if (x < mapWidth - 1) row += ',';
        }
        row += ','; // Each row ends with a comma
        output += row + '\n';
      }
      output += '\n';
    }
    
    // [event] sections if events exist
    if (events && events.length > 0) {
      events.forEach(event => {
        output += '[event]\n';
        output += 'type=event\n';
        output += `location=${event.x},${event.y},${event.width},${event.height}\n`;
        output += 'activate=on_trigger\n';
        output += `map=${event.targetMap || 'othermap.txt'}\n`;
        output += '\n';
      });
    }
    
    // [npc] sections if NPCs exist
    if (npcs && npcs.length > 0) {
      npcs.forEach(npc => {
        output += '[npc]\n';
        output += 'type=npc\n';
        output += `location=${npc.x},${npc.y},${npc.width},${npc.height}\n`;
        output += `filename=${npc.filename || 'npcs/name.txt'}\n`;
        output += '\n';
      });
    }
    
    return output;
  }

  /*
  Example Flare TXT output:
  [header]
  width=10
  height=8
  tilewidth=32
  tileheight=32
  orientation=isometric
  background_color=0,0,0,255
  hero_pos=1,1
  music=none
  tileset=tilesetdefs/tileset.txt
  title=GeneratedMap
  
  [tilesets]
  tileset=tileset.png,32,32,0,0
  
  [layer]
  type=ground
  data=
  0,0,0,0,0,0,0,0,0,0,
  0,1,2,3,0,0,0,0,0,0,
  0,4,5,6,0,0,0,0,0,0,
  
  [layer]
  type=wall
  data=
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,7,8,0,0,0,0,
  
  [layer]
  type=collision
  data=
  0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,1,1,0,0,0,0,
  
  [event]
  type=event
  location=64,96,32,32
  activate=on_trigger
  map=othermap.txt
  
  [npc]
  type=npc
  location=128,64,32,32
  filename=npcs/guard.txt
  */

  // Construct TMX XML string (single layer). Points to external tileset.tsx (commonly used by Flare).
  function buildTMXXML() {
  const gidTileWidth = tileSizeX;
  const gidTileHeight = tileSizeY;
  const header = `<?xml version="1.0" encoding="UTF-8"?>`;
  const mapOpen = `<map version="1.10" tiledversion="1.10.0" orientation="${orientation}" renderorder="right-down" width="${mapWidth}" height="${mapHeight}" tilewidth="${gidTileWidth}" tileheight="${gidTileHeight}" infinite="0">`;
    const tilesetTags = tilesets.map(ts => `<tileset firstgid="${ts.firstgid}" name="${escapeXML(ts.name)}" tilewidth="${gidTileWidth}" tileheight="${gidTileHeight}" tilecount="${ts.tileCount}" columns="${ts.columns}" source="${escapeXML(ts.name)}.tsx"/>`).join('\n');
    const layerXML = tileLayers.map(l => `  <layer name="${escapeXML(l.name)}" width="${mapWidth}" height="${mapHeight}"><data encoding="csv">\n${dataToCSV(l.data)}\n  </data></layer>`).join('\n');
    const collisionLayerXML = `  <layer name="Collision" width="${mapWidth}" height="${mapHeight}"><data encoding="csv">\n${dataToCSV(collisionData)}\n  </data></layer>`;
    const objectGroupXML = buildObjectsXML();
    const mapClose = `</map>`;
    return [header, mapOpen, tilesetTags, layerXML, collisionLayerXML, objectGroupXML, mapClose].join('\n');
  }

  function escapeXML(str) {
    return String(str).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&apos;'}[c]));
  }

  function buildObjectsXML() {
    if (!objects.length) return '';  // Return empty string if no objects
    const lines = ['  <objectgroup name="Objects">'];
    objects.forEach(o => {
      let objLine = `    <object id="${o.id}" name="${escapeXML(o.name || '')}" type="${escapeXML(o.type || '')}" x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"`;
      const propKeys = Object.keys(o.properties || {});
      if (!propKeys.length) {
        objLine += '/>';
        lines.push(objLine);
      } else {
        objLine += '>';
        lines.push(objLine);
        lines.push('      <properties>');
        propKeys.forEach(k => {
          const v = o.properties[k];
          lines.push(`        <property name="${escapeXML(k)}" value="${escapeXML(v)}"/>`);
        });
        lines.push('      </properties>');
        lines.push('    </object>');
      }
    });
    lines.push('  </objectgroup>');
    return lines.join('\n');
  }

  // Build TSX (tileset) file XML referencing embedded image (Base64) OR we can just give a template.
  // For minimalism we embed the image as Base64; user can later swap to relative path.
  // (legacy single tileset build removed in multi-tileset version)

  function downloadFile(filename, text) {
    // Determine MIME type based on file extension
    let mimeType = 'text/plain';
    if (filename.endsWith('.tmx') || filename.endsWith('.tsx')) {
      mimeType = 'application/xml';
    }
    
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Utility function alias for downloadFile (as requested in requirements)
  function downloadStringAsFile(filename, text) {
    // Creates a Blob, objectURL, triggers download, then revokes URL
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

  // Validation and export button state management
  function updateExportButtonStates() {
    // TSX export validation: requires tileset image
    if (!tilesetImage || !tilesetFileName) {
      exportTSXBtn.disabled = true;
      exportTSXBtn.title = 'Load a tileset PNG first';
    } else {
      exportTSXBtn.disabled = false;
      exportTSXBtn.title = 'Export tileset.tsx';
    }
    
    // TMX export validation: requires valid map size and at least one layer with data
    const hasValidMapSize = mapWidth > 0 && mapHeight > 0;
    const hasLayers = tileLayers && tileLayers.length > 0;
    
    if (!hasValidMapSize || !hasLayers) {
      exportTMXBtn.disabled = true;
      exportTMXBtn.title = 'Map must have valid size and at least one layer';
    } else {
      exportTMXBtn.disabled = false;
      exportTMXBtn.title = 'Export map.tmx';
    }
    
    // Flare TXT export validation: requires valid map size and at least one layer
    if (!hasValidMapSize || !hasLayers) {
      exportFlareTXTBtn.disabled = true;
      exportFlareTXTBtn.title = 'Map must have valid size and at least one layer';
    } else {
      exportFlareTXTBtn.disabled = false;
      exportFlareTXTBtn.title = 'Export map.txt in Flare format';
    }
  }

  // Test function to verify multi-layer TMX export functionality
  function testTMXExport() {
    const testLayers = [
      {
        name: 'Ground',
        data: [
          0,0,0,0,0,
          0,1,2,3,0,
          0,4,5,6,0,
          0,0,0,0,0
        ]
      },
      {
        name: 'Wall',
        data: [
          7,7,7,7,7,
          7,0,0,0,7,
          7,0,0,0,7,
          7,7,7,7,7
        ]
      },
      {
        name: 'Decor',
        data: [
          0,0,0,0,0,
          0,0,8,0,0,
          0,9,0,10,0,
          0,0,0,0,0
        ]
      }
    ];
    
    const result = exportAsTMX({
      mapWidth: 5,
      mapHeight: 4,
      tileWidth: 32,
      tileHeight: 32,
      layers: testLayers,
      tilesetRef: null
    });
    
    console.log('Test Multi-Layer TMX Export Result:');
    console.log(result);
    return result;
  }

  // Test function to verify TSX export functionality
  function testTSXExport() {
    const result = exportAsTSX({
      tileWidth: 32,
      tileHeight: 32,
      imageWidth: 512,
      imageHeight: 512,
      tilesetPngName: 'tileset.png'
    });
    
    console.log('Test TSX Export Result:');
    console.log(result);
    return result;
  }

  // Test function to verify Object system functionality
  function testObjectExport() {
    // Create test objects to demonstrate the system
    const testObjects = [
      {
        id: 1,
        name: 'main_door',
        type: 'event',
        x: 128,
        y: 32,
        width: 32,
        height: 32,
        properties: { map: 'town.tmx' }
      },
      {
        id: 2,
        name: 'guard',
        type: 'npc', 
        x: 96,
        y: 96,
        width: 32,
        height: 32,
        properties: { dialog: 'Welcome to our town!' }
      },
      {
        id: 3,
        name: 'spawn_point',
        type: 'spawn',
        x: 64,
        y: 192,
        width: 32,
        height: 32,
        properties: {}
      }
    ];
    
    // Temporarily set objects for testing
    const originalObjects = objects;
    objects.length = 0;
    objects.push(...testObjects);
    
    const result = buildObjectsXML();
    
    // Restore original objects
    objects.length = 0;
    objects.push(...originalObjects);
    
    console.log('Test Object Export Result:');
    console.log(result);
    return result;
  }

  // Painting logic
  let isMouseDown = false;
  let lastPaintedCell = null; // prevent redundant painting when dragging within same cell

  function placeTileAt(x, y, gid) {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return;
    const layer = getActiveLayer();
    if (!layer) return;
    const idx = y * mapWidth + x;
    if (layer.data[idx] !== gid) {
      const old = layer.data[idx];
      const layerId = layer.id;
      const action = {
        type: 'tile', layerId, x, y, from: old, to: gid,
        apply() { const L = tileLayers.find(l=>l.id===layerId); if (L) L.data[y*mapWidth + x] = gid; },
        revert() { const L = tileLayers.find(l=>l.id===layerId); if (L) L.data[y*mapWidth + x] = old; }
      };
      action.apply();
      pushAction(action);
      draw();
    }
  }

  function toggleCollisionAt(x, y, value) {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return;
    const idx = y * mapWidth + x;
    const newVal = value !== undefined ? value : (collisionData[idx] ? 0 : 1);
    if (collisionData[idx] !== newVal) {
      const old = collisionData[idx];
      const action = {
        type: 'collision', x, y, from: old, to: newVal,
        apply() { collisionData[y*mapWidth + x] = newVal; },
        revert() { collisionData[y*mapWidth + x] = old; }
      };
      action.apply();
      pushAction(action);
      draw();
    }
  }

  function getObjectAtPixel(px, py) {
    // Iterate in reverse draw order (topmost last) -> objects array order is insertion; treat later ones as top
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (px >= o.x && py >= o.y && px <= o.x + o.width && py <= o.y + o.height) {
        return o;
      }
    }
    return null;
  }

  function selectObject(id) {
    selectedObjectId = id;
    refreshObjectUI();
    draw();
  }

  function refreshObjectUI() {
    // List
    objectListEl.innerHTML = '';
    objects.forEach(o => {
      const row = document.createElement('div');
      row.className = 'objectRow' + (o.id === selectedObjectId ? ' selected' : '');
      row.textContent = `#${o.id} ${o.type}${o.name ? ':' + o.name : ''}`;
      row.addEventListener('click', () => selectObject(o.id));
      objectListEl.appendChild(row);
    });
    const selObj = objects.find(o => o.id === selectedObjectId);
    if (!selObj) {
      selectedObjectInfo.textContent = 'No object selected.';
      propertiesForm.innerHTML = '';
      return;
    }
    selectedObjectInfo.textContent = `Selected: id=${selObj.id} type=${selObj.type} (${selObj.width}x${selObj.height})`;
    // Build properties form
    propertiesForm.innerHTML = '';
    const nameRow = document.createElement('div');
    nameRow.className = 'propRow';
    nameRow.innerHTML = '<label style="font-size:0.65rem">Name:</label>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = selObj.name || '';
    nameInput.addEventListener('input', () => { selObj.name = nameInput.value; draw(); refreshObjectUI(); });
    nameRow.appendChild(nameInput);
    propertiesForm.appendChild(nameRow);

    Object.keys(selObj.properties).forEach(key => {
      const val = selObj.properties[key];
      propertiesForm.appendChild(makePropertyRow(selObj, key, val));
    });
  }

  function makePropertyRow(obj, key, value) {
    const row = document.createElement('div');
    row.className = 'propRow';
    const keyInput = document.createElement('input');
    keyInput.type = 'text'; keyInput.value = key; keyInput.placeholder = 'key';
    const valInput = document.createElement('input');
    valInput.type = 'text'; valInput.value = value; valInput.placeholder = 'value';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.textContent = '✕'; delBtn.className = 'danger';
    keyInput.addEventListener('input', () => {
      if (key !== keyInput.value) {
        delete obj.properties[key];
        key = keyInput.value;
      }
      obj.properties[key] = valInput.value;
    });
    valInput.addEventListener('input', () => { obj.properties[key] = valInput.value; });
    delBtn.addEventListener('click', () => { delete obj.properties[key]; refreshObjectUI(); draw(); });
    row.appendChild(keyInput); row.appendChild(valInput); row.appendChild(delBtn);
    return row;
  }

  addPropertyBtn.addEventListener('click', () => {
    const selObj = objects.find(o => o.id === selectedObjectId);
    if (!selObj) return;
    let base = 'prop'; let i = 1; while (selObj.properties[base + i]) i++; selObj.properties[base + i] = '';
    refreshObjectUI();
  });

  function addObject(x, y, w, h, type) {
    const obj = { id: nextObjectId++, name: '', type: type || 'object', x, y, width: w, height: h, properties: {} };
    const id = obj.id;
    const action = {
      type: 'addObject', id,
      apply(){ objects.push(obj); },
      revert(){ const i=objects.findIndex(o=>o.id===id); if(i>=0) objects.splice(i,1); if(selectedObjectId===id) selectedObjectId=null; }
    };
    action.apply(); pushAction(action); selectObject(id); draw();
  }

  function drawMiniMap() {
    // Simple scaled rendering: fit entire map into miniMapCanvas
    const mmW = miniMapCanvas.width;
    const mmH = miniMapCanvas.height;
    miniCtx.fillStyle = '#000';
    miniCtx.fillRect(0, 0, mmW, mmH);
    if (!tilesetImage || mapWidth === 0 || mapHeight === 0) return;
    const scaleX = mmW / (mapWidth * tileSizeX);
    const scaleY = mmH / (mapHeight * tileSizeY);
    const s = Math.min(scaleX, scaleY);
    // Draw each non-zero tile as average color (sample center pixel) - quick & approximate
    tileLayers.forEach(layer => {
      if (!layer.visible) return;
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const gid = layer.data[y * mapWidth + x];
          if (gid > 0) {
            const tileIndex = gid - 1;
            const sx = (tileIndex % tilesetColumns) * tileSizeX;
            const sy = Math.floor(tileIndex / tilesetColumns) * tileSizeY;
            offscreen.width = tileSizeX; offscreen.height = tileSizeY;
            offctx.drawImage(tilesetImage, sx, sy, tileSizeX, tileSizeY, 0, 0, tileSizeX, tileSizeY);
            const d = offctx.getImageData(tileSizeX/2|0, tileSizeY/2|0, 1, 1).data;
            miniCtx.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
            miniCtx.fillRect(x * tileSizeX * s, y * tileSizeY * s, tileSizeX * s, tileSizeY * s);
          }
        }
      }
    });
    if (collisionVisible) {
      miniCtx.fillStyle = 'rgba(255,0,0,0.4)';
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          if (collisionData[y * mapWidth + x]) {
            miniCtx.fillRect(x * tileSizeX * s, y * tileSizeY * s, tileSizeX * s, tileSizeY * s);
          }
        }
      }
    }
    // Objects outline
    miniCtx.strokeStyle = '#fff';
    objects.forEach(o => {
      miniCtx.strokeRect(o.x * s, o.y * s, o.width * s, o.height * s);
    });
  }

  mapCanvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = mapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let tx, ty;
    if (orientation === 'isometric') {
      // Inverse isometric transform - accounting for tile centering
      const cx = mx - (mapHeight * tileSizeX / 2) - (tileSizeX / 2);
      const cy = my - (tileSizeY / 2);
      tx = Math.floor((cx / (tileSizeX / 2) + cy / (tileSizeY / 2)) / 2);
      ty = Math.floor((cy / (tileSizeY / 2) - cx / (tileSizeX / 2)) / 2);
    } else {
      tx = Math.floor(mx / tileSizeX);
      ty = Math.floor(my / tileSizeY);
    }
    isMouseDown = true;
    lastPaintedCell = `${tx},${ty}`;

    if (activeTool === 'tiles') {
      if (e.button === 2) {
        placeTileAt(tx, ty, 0);
      } else if (activeGid > 0) {
        placeTileAt(tx, ty, activeGid);
      }
    } else if (activeTool === 'collision') {
      if (e.button === 2) {
        toggleCollisionAt(tx, ty, 0);
      } else {
        toggleCollisionAt(tx, ty, 1);
      }
    } else if (activeTool === 'objects') {
      const px = mx; const py = my;
      const hit = getObjectAtPixel(px, py);
      if (hit) {
        selectObject(hit.id);
        // Decide if resize (near bottom-right corner within 6px)
        const nearCorner = (Math.abs((hit.x + hit.width) - px) < 6 && Math.abs((hit.y + hit.height) - py) < 6);
        if (nearCorner) {
          draggingObject = { id: hit.id, mode: 'resize', startW: hit.width, startH: hit.height, originX: hit.x, originY: hit.y, startX: px, startY: py, prev: { x: hit.x, y: hit.y, width: hit.width, height: hit.height } };
        } else {
          draggingObject = { id: hit.id, mode: 'move', offsetX: px - hit.x, offsetY: py - hit.y, prev: { x: hit.x, y: hit.y, width: hit.width, height: hit.height } };
        }
      } else {
        // Create new object with default size = 1 tile
        addObject(tx * tileSizeX, ty * tileSizeY, tileSizeX, tileSizeY, objectTypeSelect.value);
        const newObj = objects[objects.length - 1];
        draggingObject = { id: newObj.id, mode: 'resize', startW: newObj.width, startH: newObj.height, originX: newObj.x, originY: newObj.y, startX: mx, startY: my, prev: { x: newObj.x, y: newObj.y, width: newObj.width, height: newObj.height } };
      }
    }
  });
  mapCanvas.addEventListener('mousemove', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let tx, ty;
    if (orientation === 'isometric') {
      const cx = mx - (mapHeight * tileSizeX / 2) - (tileSizeX / 2);
      const cy = my - (tileSizeY / 2);
      tx = Math.floor((cx / (tileSizeX / 2) + cy / (tileSizeY / 2)) / 2);
      ty = Math.floor((cy / (tileSizeY / 2) - cx / (tileSizeX / 2)) / 2);
    } else {
      tx = Math.floor(mx / tileSizeX);
      ty = Math.floor(my / tileSizeY);
    }
    
    // Update hover position and redraw if changed
    const prevHoverX = hoverTileX;
    const prevHoverY = hoverTileY;
    hoverTileX = tx;
    hoverTileY = ty;
    
    if (tx >= 0 && ty >= 0 && tx < mapWidth && ty < mapHeight) {
      hoverInfo.textContent = `Hover: (${tx},${ty})`;
      // Redraw only if hover position changed
      if (prevHoverX !== hoverTileX || prevHoverY !== hoverTileY) {
        draw();
      }
    } else {
      hoverInfo.textContent = 'Hover: -';
      hoverTileX = -1;
      hoverTileY = -1;
      // Redraw to remove hover effect if we moved outside the map
      if (prevHoverX !== -1 || prevHoverY !== -1) {
        draw();
      }
    }

    if (activeTool === 'tiles' || activeTool === 'collision') {
      if (isMouseDown) {
        const key = `${tx},${ty}`;
        if (key !== lastPaintedCell) {
          lastPaintedCell = key;
          if (activeTool === 'tiles') {
            if (e.buttons === 2) {
              placeTileAt(tx, ty, 0);
            } else if (e.buttons === 1 && activeGid > 0) {
              placeTileAt(tx, ty, activeGid);
            }
          } else if (activeTool === 'collision') {
            if (e.buttons === 2) toggleCollisionAt(tx, ty, 0); else if (e.buttons === 1) toggleCollisionAt(tx, ty, 1);
          }
        }
      }
    } else if (activeTool === 'objects' && draggingObject) {
      const obj = objects.find(o => o.id === draggingObject.id);
      if (!obj) return;
      if (draggingObject.mode === 'move') {
        obj.x = mx - draggingObject.offsetX;
        obj.y = my - draggingObject.offsetY;
      } else if (draggingObject.mode === 'resize') {
  const newW = Math.max(tileSizeX, draggingObject.startW + (mx - draggingObject.startX));
  const newH = Math.max(tileSizeY, draggingObject.startH + (my - draggingObject.startY));
  obj.width = newW; obj.height = newH;
      }
      draw();
      refreshObjectUI();
    }
  });
  mapCanvas.addEventListener('mouseup', () => {
    if (draggingObject && draggingObject.prev) {
      const obj = objects.find(o=>o.id===draggingObject.id);
      if (obj) {
        const before = draggingObject.prev;
        const after = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        if (before.x!==after.x || before.y!==after.y || before.width!==after.width || before.height!==after.height) {
          const id = obj.id;
          pushAction({
            type: 'objectTransform', id, before, after,
            apply(){ const o=objects.find(o=>o.id===id); if(o) Object.assign(o, after); },
            revert(){ const o=objects.find(o=>o.id===id); if(o) Object.assign(o, before); }
          });
        }
      }
    }
    isMouseDown = false; draggingObject = null; });
  mapCanvas.addEventListener('mouseleave', () => { isMouseDown = false; draggingObject = null; });
  mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // UI events
  // Tile size and orientation are now fixed - no event listeners needed

  tilesetFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // Track the original filename for TSX export
    tilesetFileName = file.name;
    
    const img = new Image();
    img.onload = () => {
      tilesetImage = img;
  tilesetColumns = Math.floor(img.width / tileSizeX);
  tilesetRows = Math.floor(img.height / tileSizeY);
  tileCount = tilesetColumns * tilesetRows;
  // Rebuild tilesets with primary firstgid=1 and adjust extras if existed
  const extras = tilesets.filter(t => t.name !== 'main');
  let firstgidCursor = 1 + tileCount;
  extras.forEach(ex => { ex.firstgid = firstgidCursor; firstgidCursor += ex.tileCount; });
  tilesets = [{ name: 'main', image: img, columns: tilesetColumns, rows: tilesetRows, tileCount, firstgid: 1 }, ...extras];
  buildTilesetButtons(); draw();
  
  // Update export button states
  updateExportButtonStates();
    };
    img.onerror = () => alert('Failed to load image. Ensure it is a valid PNG.');
    img.src = URL.createObjectURL(file);
  });

  extraTilesetFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (!tilesetImage) { alert('Load a primary tileset first.'); return; }
    const img = new Image();
    img.onload = () => {
      const columns = Math.floor(img.width / tileSizeX);
      const rows = Math.floor(img.height / tileSizeY);
      const count = columns * rows;
      let firstgid = 1; tilesets.forEach(ts => { firstgid = Math.max(firstgid, ts.firstgid + ts.tileCount); });
      tilesets.push({ name: `extra${tilesets.length}`, image: img, columns, rows, tileCount: count, firstgid });
      buildTilesetButtons(); draw();
    };
    img.onerror = () => alert('Failed to load extra tileset.');
    img.src = URL.createObjectURL(file);
  });

  resizeMapBtn.addEventListener('click', () => {
    const newW = parseInt(mapWidthInput.value, 10) || mapWidth;
    const newH = parseInt(mapHeightInput.value, 10) || mapHeight;
    resizeMap(newW, newH);
  });
  clearMapBtn.addEventListener('click', () => {
    if (confirm('Clear active layer / collision?')) clearActiveLayer();
  });
  exportTMXBtn.addEventListener('click', () => {
    // Validation: ensure map has valid dimensions and layers
    if (mapWidth <= 0 || mapHeight <= 0) {
      alert('Map must have valid width and height');
      return;
    }
    
    if (!tileLayers || tileLayers.length === 0) {
      alert('Map must have at least one layer');
      return;
    }
    
    // Get the three built-in layers in order: Ground, Wall, Decor
    const builtInLayers = getBuiltInLayers();
    
    const xml = exportAsTMX({
      mapWidth: mapWidth,
      mapHeight: mapHeight,
      tileWidth: tileSizeX,
      tileHeight: tileSizeY,
      layers: builtInLayers,
      tilesetRef: null // Placeholder for now
    });
    
    downloadStringAsFile('map.tmx', xml);
  });
  exportTSXBtn.addEventListener('click', () => {
    // Validation: ensure tileset image is loaded
    if (!tilesetImage) {
      alert('Load a tileset first.');
      return;
    }
    
    if (!tilesetFileName) {
      alert('No tileset filename available.');
      return;
    }
    
    // Use the original uploaded filename, ensuring it has .png extension
    let imageSourceName = tilesetFileName;
    if (!imageSourceName.toLowerCase().endsWith('.png')) {
      imageSourceName = imageSourceName.replace(/\.[^.]*$/, '') + '.png';
    }
    
    // Use the primary tileset image for export
    const tsx = exportAsTSX({
      tileWidth: tileSizeX,
      tileHeight: tileSizeY,
      imageWidth: tilesetImage.width,
      imageHeight: tilesetImage.height,
      tilesetPngName: imageSourceName
    });
    
    downloadStringAsFile('tileset.tsx', tsx);
  });

  exportFlareTXTBtn.addEventListener('click', () => {
    // Validation: ensure map has valid dimensions and layers
    if (mapWidth <= 0 || mapHeight <= 0) {
      alert('Map must have valid width and height');
      return;
    }
    
    if (!tileLayers || tileLayers.length === 0) {
      alert('Map must have at least one layer');
      return;
    }
    
    // Get the three built-in layers in order: Ground, Wall, Decor
    const builtInLayers = getBuiltInLayers();
    
    // Check if collision data exists and has non-zero values
    const hasCollisionData = collisionData && collisionData.some(val => val !== 0);
    
    // Prepare events and NPCs from objects if they exist
    const events = [];
    const npcs = [];
    
    if (objects && objects.length > 0) {
      objects.forEach(obj => {
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
    }
    
    const flareTXT = exportAsFlareTXT({
      mapWidth: mapWidth,
      mapHeight: mapHeight,
      tileWidth: tileSizeX,
      tileHeight: tileSizeY,
      layers: builtInLayers,
      collisionLayer: hasCollisionData ? collisionData : null,
      tilesets: tilesets && tilesets.length > 0 ? tilesets : null,
      events: events.length > 0 ? events : null,
      npcs: npcs.length > 0 ? npcs : null,
      heroPos: '1,1', // default hero position
      music: 'none', // default music
      title: 'GeneratedMap' // default title
    });
    
    downloadStringAsFile('map.txt', flareTXT);
  });

  importTMXFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { importTMX(reader.result); } catch(err){ console.error(err); alert('TMX import failed'); } }; reader.readAsText(file);
  });
  importTSXFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { importTSX(reader.result); } catch(err){ console.error(err); alert('TSX import failed'); } }; reader.readAsText(file);
  });

  function importTSX(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const tsEl = doc.querySelector('tileset'); if (!tsEl) throw new Error('No tileset');
    const name = tsEl.getAttribute('name') || `tsx${Date.now()}`;
  const tilewidth = parseInt(tsEl.getAttribute('tilewidth'), 10);
  const tileheight = parseInt(tsEl.getAttribute('tileheight'), 10);
  if (tilewidth !== tileSizeX || tileheight !== tileSizeY) { alert('TSX tile size mismatch current tile size.'); return; }
    const imgEl = tsEl.querySelector('image'); if (!imgEl) throw new Error('No image');
    const src = imgEl.getAttribute('source') || '';
    if (!src.startsWith('data:image')) { alert('Only Base64 embedded images supported for TSX import.'); return; }
    const img = new Image();
    img.onload = () => {
      const columns = Math.floor(img.width / tileSize);
      const rows = Math.floor(img.height / tileSize);
      const count = columns * rows;
      let firstgid = 1; tilesets.forEach(t => { firstgid = Math.max(firstgid, t.firstgid + t.tileCount); });
      tilesets.push({ name, image: img, columns, rows, tileCount: count, firstgid });
      if (!tilesetImage) tilesetImage = img;
      buildTilesetButtons(); draw();
    };
    img.src = src;
  }

  function parseCSVData(dataNode) {
    const text = dataNode.textContent.trim();
    const rows = text.split(/\n+/);
    const arr = [];
    rows.forEach(r => { if (r.trim()) r.split(',').forEach(n => arr.push(parseInt(n,10)||0)); });
    return arr;
  }

  function importTMX(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const mapEl = doc.querySelector('map'); if (!mapEl) throw new Error('No map element');
    const w = parseInt(mapEl.getAttribute('width'),10); const h = parseInt(mapEl.getAttribute('height'),10);
  const tw = parseInt(mapEl.getAttribute('tilewidth'),10);
  const th = parseInt(mapEl.getAttribute('tileheight'),10);
  if (tw !== tileSizeX || th !== tileSizeY) { alert('TMX tile size mismatch. Adjust tile size first.'); return; }
    resizeMap(w,h);
    tileLayers = []; activeLayerId = null; nextLayerId = 1; collisionData = new Array(mapWidth * mapHeight).fill(0);
    const layerEls = [...doc.querySelectorAll('layer')];
    layerEls.forEach(l => {
      const name = l.getAttribute('name') || 'Layer';
      const dataNode = l.querySelector('data'); if (!dataNode) return;
      const arr = parseCSVData(dataNode);
      if (name === 'Collision') {
        for (let i=0;i<collisionData.length && i<arr.length;i++) collisionData[i] = arr[i];
      } else {
        const lyr = createLayer(name);
        for (let i=0;i<lyr.data.length && i<arr.length;i++) lyr.data[i] = arr[i];
      }
    });
    if (!tileLayers.length) createLayer('Layer1');
    objects = []; nextObjectId = 1; selectedObjectId = null;
    const objGroup = doc.querySelector('objectgroup[name="Objects"]');
    if (objGroup) {
      [...objGroup.querySelectorAll('object')].forEach(oel => {
        const id = parseInt(oel.getAttribute('id'),10) || nextObjectId++;
        const type = oel.getAttribute('type') || 'object';
        const name = oel.getAttribute('name') || '';
        const x = parseFloat(oel.getAttribute('x'))||0;
        const y = parseFloat(oel.getAttribute('y'))||0;
        const width = parseFloat(oel.getAttribute('width'))||tileSize;
        const height = parseFloat(oel.getAttribute('height'))||tileSize;
        const properties = {};
        const propsEl = oel.querySelector('properties');
        if (propsEl) { [...propsEl.querySelectorAll('property')].forEach(p => { properties[p.getAttribute('name')] = p.getAttribute('value') || ''; }); }
        objects.push({ id, name, type, x, y, width, height, properties });
        nextObjectId = Math.max(nextObjectId, id+1);
      });
    }
    refreshLayersUI(); refreshObjectUI(); draw(); undoStack.length=0; redoStack.length=0; updateUndoUI();
  }

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase()==='z') { undo(); e.preventDefault(); }
    else if (e.ctrlKey && (e.key.toLowerCase()==='y' || (e.shiftKey && e.key.toLowerCase()==='z'))) { redo(); e.preventDefault(); }
  });

  // Layers UI management
  function refreshLayersUI() {
    layersList.innerHTML = '';
    tileLayers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'layerItem' + (layer.id === activeLayerId ? ' active' : '');
      const vis = document.createElement('input'); vis.type = 'checkbox'; vis.checked = layer.visible; vis.title = 'Visibility';
      vis.addEventListener('change', (e) => { layer.visible = vis.checked; draw(); });
      const nameSpan = document.createElement('span'); nameSpan.textContent = layer.name; nameSpan.contentEditable = 'true'; nameSpan.spellcheck = false;
      nameSpan.addEventListener('input', () => { layer.name = nameSpan.textContent.trim() || 'Layer'; });
      div.appendChild(vis);
      div.appendChild(nameSpan);
      div.addEventListener('click', (ev) => { activeLayerId = layer.id; refreshLayersUI(); });
      layersList.appendChild(div);
    });
    // Collision pseudo-entry
    const collDiv = document.createElement('div');
    collDiv.className = 'layerItem' + (activeTool === 'collision' ? ' active' : '');
    const cVis = document.createElement('input'); cVis.type = 'checkbox'; cVis.checked = collisionVisible; cVis.title = 'Visibility';
    cVis.addEventListener('change', () => { collisionVisible = cVis.checked; draw(); });
    const label = document.createElement('span'); label.textContent = 'Collision';
    collDiv.appendChild(cVis); collDiv.appendChild(label);
    layersList.appendChild(collDiv);
  }

  addLayerBtn.addEventListener('click', () => createLayer());
  delLayerBtn.addEventListener('click', () => {
    if (!activeLayerId) return; if (!confirm('Delete current layer?')) return;
    const idx = tileLayers.findIndex(l => l.id === activeLayerId);
    if (idx >= 0) {
      tileLayers.splice(idx, 1);
      activeLayerId = tileLayers.length ? tileLayers[Math.max(0, idx - 1)].id : null;
      refreshLayersUI(); draw();
    }
  });
  layerUpBtn.addEventListener('click', () => {
    const i = tileLayers.findIndex(l => l.id === activeLayerId); if (i > 0) { [tileLayers[i - 1], tileLayers[i]] = [tileLayers[i], tileLayers[i - 1]]; refreshLayersUI(); draw(); }
  });
  layerDownBtn.addEventListener('click', () => {
    const i = tileLayers.findIndex(l => l.id === activeLayerId); if (i >= 0 && i < tileLayers.length - 1) { [tileLayers[i + 1], tileLayers[i]] = [tileLayers[i], tileLayers[i + 1]]; refreshLayersUI(); draw(); }
  });

  // Tool selection
  toolBar.addEventListener('change', (e) => {
    const selected = [...toolBar.querySelectorAll('input[name=tool]')].find(r => r.checked);
    if (selected) activeTool = selected.value;
    refreshLayersUI();
  });

  // Initial state
  createLayer('Ground');
  createLayer('Wall');
  createLayer('Decor');
  // Ensure order remains as created (Ground bottom). We'll leave them appended in order.
  activeLayerId = tileLayers[0].id;
  refreshLayersUI();
  resizeMapCanvas();
  setActiveGid(0);
  updateUndoUI();
  updateExportButtonStates(); // Initialize export button states

  // ====== Extension Ideas (brief) ======
  // 1. Multiple Layers: store array of layerData arrays; add UI to switch active layer; export multiple <layer> tags.
  // 2. Collision Mask: separate boolean layer; export custom properties or extra layer name like "Collision".
  // 3. Autotiling: on tile placement, inspect neighbors to choose variant.
  // 4. Undo/Redo: maintain stack of changes {index, old, new}.
  // 5. Camera/Scrolling: larger maps by limiting canvas size and implementing panning.
  // 6. Import TMX: parse XML, load external tileset, fill layerData.
  // 7. Advanced object editing (rotation, custom shapes, polygons, ellipses).
  // 8. Selection marquee & fill tools.
})();
