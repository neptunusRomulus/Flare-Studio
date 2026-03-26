# Per-Tab Painting Data - Developer Guide

## Architecture Overview

### The Problem: Shared Painting Data

Before this fix, the tile painting data was stored **per-layer**, not **per-tab**:

```typescript
// OLD (BROKEN)
private tileLayers: TileLayer[] = [
  {
    id: 1,
    name: "Background",
    type: "background",
    data: [1, 2, 0, 3, ...],  // ← SHARED by ALL tabs!
    visible: true
  }
];

private layerTabs: Map<string, Array<{
  id: number;
  name: string;
  tileset?: LayerTilesetEntry;      // Tab-specific
  detectedTiles?: Map<...>;          // Tab-specific
  brushes?: Array<...>;              // Tab-specific
  // ❌ NO data field - painting data not stored per-tab!
}>> = new Map();
```

**Problem**: When you painted on different tabs, they all modified the same `tileLayers[0].data` array, overwriting each other's paintings.

### The Solution: Per-Tab Data Arrays

Now each tab stores its own painting data:

```typescript
// NEW (FIXED)
private layerTabs: Map<string, Array<{
  id: number;
  name: string;
  data?: number[];                    // ✅ NEW: Per-tab painting data
  tileset?: LayerTilesetEntry;        // Tab-specific
  detectedTiles?: Map<...>;           // Tab-specific
  brushes?: Array<...>;               // Tab-specific
}>> = new Map();
```

## Data Flow During Tab Switch

### Phase 1: Save Current Tab's Painting

```typescript
const currentActiveTabId = this.layerActiveTabId.get(layerType);
if (currentActiveTabId !== undefined) {
  const currentActiveTab = tabs?.find(t => t.id === currentActiveTabId);
  const layer = this.tileLayers.find(l => l.type === layerType);
  
  if (currentActiveTab && layer) {
    // Save the current layer's painted tiles to the currently active tab
    currentActiveTab.data = [...layer.data];
  }
}
```

**Why copy?** We use `[...layer.data]` (spread operator) instead of direct assignment to create a new array, preventing accidental modifications to the original.

### Phase 2: Switch Active Tab ID

```typescript
this.layerActiveTabId.set(layerType, tabId);
```

This updates which tab is "active" for the layer type.

### Phase 3: Load New Tab's Painting

```typescript
const layer = this.tileLayers.find(l => l.type === layerType);
if (tab && layer) {
  if (tab.data) {
    // Restore the new tab's painting to the layer
    layer.data = [...tab.data];
  } else {
    // New tab with no painting yet
    layer.data = new Array(this.mapWidth * this.mapHeight).fill(0);
  }
}
```

This restores the new tab's painting data so the canvas draws it correctly.

### Phase 4: Update Palette & Redraw

```typescript
// Update tileset/palette display for the new tab
this.updateCurrentTileset(layerType);

// Redraw canvas with new tab's painting
this.draw();
```

## Serialization: Saving to Disk

### Data Collection in `getProjectData()`

```typescript
tabsObj[layerType] = tabs.map(t => {
  const ser = { id: t.id, name: t.name };
  
  // NEW: Include per-tab painting data
  if (t.data && t.data.length > 0) {
    ser.data = [...t.data];  // Copy array
    console.log(`[SAVE] Tab ${t.id}: saving ${t.data.filter(v => v > 0).length} painted tiles`);
  }
  
  // Include tileset and detected tiles metadata
  if (t.tileset) {
    ser.tileset = { /* ... */ };
  }
  if (t.detectedTiles && t.detectedTiles.size > 0) {
    ser.detectedTiles = Array.from(t.detectedTiles.entries());
  }
  
  return ser;
});
```

### Serialized Format in Project File

```json
{
  "layerTabs": {
    "background": [
      {
        "id": 1,
        "name": "Main Terrain",
        "data": [1, 2, 0, 3, ...],  // ← NEW: Painting data array
        "tileset": { "fileName": "terrain.png", ... },
        "detectedTiles": [ [1, { "sourceX": 0, ... }], ... ]
      },
      {
        "id": 2,
        "name": "Decorations",
        "data": [5, 6, 7, 8, ...],  // ← NEW: Different painting
        "tileset": { "fileName": "decorations.png", ... },
        "detectedTiles": [ ... ]
      }
    ]
  }
}
```

## Deserialization: Loading from Disk

### Data Restoration in `loadProjectData()`

```typescript
for (const t of tabs || []) {
  const tabId = t.id;
  const tabObj = { id: tabId, name: t.name };
  
  // NEW: Restore per-tab painting data
  if (t.data && Array.isArray(t.data)) {
    tabObj.data = [...t.data];  // Copy array from saved data
    console.log(`[LOAD] Tab ${tabId}: restored ${t.data.filter(v => v > 0).length} painted tiles`);
  } else {
    // Tab didn't have saved painting, start empty
    const mapWidth = projectData.width || 20;
    const mapHeight = projectData.height || 15;
    tabObj.data = new Array(mapWidth * mapHeight).fill(0);
  }
  
  // Restore tileset metadata
  if (t.tileset && t.tileset.fileName) {
    tabObj.tileset = { /* rehydrate tileset */ };
  }
  
  // Restore detected tiles
  if (t.detectedTiles && Array.isArray(t.detectedTiles)) {
    tabObj.detectedTiles = new Map(t.detectedTiles);
  }
}
```

## Array Structure: What is `data`?

The `data` array is a 1D array representing the 2D map:

```
Map Grid:          Data Array:
[0,0] [0,1] [0,2]   [1, 2, 0,
[1,0] [1,1] [1,2]  → 3, 4, 5,
[2,0] [2,1] [2,2]    0, 7, 8]

Formula: index = y * mapWidth + x
To access tile at (x=1, y=1):
  data[1 * 3 + 1] = data[4] = 4
```

**Array Size**: `mapWidth * mapHeight` (e.g., 20 × 15 = 300 cells)
**Each Element**: GID (Global ID) of the tile at that position
  - `0` = empty (no tile painted)
  - `> 0` = tile ID from the tileset

## Performance Characteristics

### Memory Usage
- **Per Tab**: 1 number array of size `mapWidth * mapHeight`
- **Typical Size**: 300 cells × 4 bytes per number = 1.2 KB per tab
- **Example**: 5 tabs × 1.2 KB = 6 KB (negligible)

### Time Complexity
- **Tab Switch**: O(mapWidth × mapHeight) to copy array
- **Typical Time**: ~1-2ms for a 20×15 map
- **Impact**: Imperceptible to user

### Array Copy Efficiency
```typescript
// Safe copy (prevents aliasing issues)
tabObj.data = [...t.data];  // Shallow copy - O(n)

// vs. potential pitfall (would cause aliasing)
tabObj.data = t.data;  // ❌ Both reference same array!
```

## Edge Cases & Handling

### Case 1: Tab Created Before Save
```typescript
// In createLayerTab():
data: new Array(this.mapWidth * this.mapHeight).fill(0)
// New tabs start with empty painting ✓
```

### Case 2: Project Loaded with Old Format (No `data` field)
```typescript
if (t.data && Array.isArray(t.data)) {
  tabObj.data = [...t.data];  // Load if present
} else {
  // Initialize empty for backward compatibility
  tabObj.data = new Array(mapWidth * mapHeight).fill(0);
}
```

### Case 3: Map Resized While Tabs Exist
When `resizeMap()` is called, **all layers** get resized, which should also resize tab data:

```typescript
// TODO: Consider adding this to resizeMap():
for (const [layerType, tabs] of this.layerTabs.entries()) {
  for (const tab of tabs) {
    if (tab.data) {
      const newData = new Array(width * height).fill(0);
      // Copy existing data to new array
      for (let y = 0; y < Math.min(height, oldHeight); y++) {
        for (let x = 0; x < Math.min(width, oldWidth); x++) {
          const oldIndex = y * oldWidth + x;
          const newIndex = y * width + x;
          newData[newIndex] = tab.data[oldIndex] || 0;
        }
      }
      tab.data = newData;
    }
  }
}
```

### Case 4: Tab Deleted
```typescript
// In removeLayerTab():
const tabs = this.layerTabs.get(layerType) || [];
const idx = tabs.findIndex(t => t.id === tabId);
if (idx !== -1) {
  // Tab.data is automatically garbage collected when tab is deleted
  tabs.splice(idx, 1);  // Removes tab including its data array
}
```

## Testing Strategy

### Unit Tests (Pseudo-code)

```typescript
describe('Per-Tab Painting Data', () => {
  test('Tab stores painting data independently', () => {
    const editor = new TileMapEditor(canvas);
    const tab1 = editor.createLayerTab('background');
    const tab2 = editor.createLayerTab('background');
    
    // Paint on tab 1
    editor.setActiveLayerTab('background', tab1);
    editor.paintTile(0, 0, 1);  // Paint tile 1
    
    // Paint on tab 2
    editor.setActiveLayerTab('background', tab2);
    editor.paintTile(0, 0, 2);  // Paint tile 2
    
    // Verify each tab has different painting
    editor.setActiveLayerTab('background', tab1);
    assert(editor.getTile(0, 0) === 1);  // Tab 1 still has tile 1
    
    editor.setActiveLayerTab('background', tab2);
    assert(editor.getTile(0, 0) === 2);  // Tab 2 has tile 2
  });
  
  test('Painting data persists across save/load', () => {
    // Create and paint on multiple tabs
    // Save project
    const saved = editor.getProjectData();
    
    // Load into new editor
    const editor2 = new TileMapEditor(canvas);
    editor2.loadProjectData(saved);
    
    // Verify tab data restored
    editor2.setActiveLayerTab('background', tab1);
    assert(editor2.getTile(0, 0) === 1);  // Tab 1 painting preserved
  });
});
```

### Integration Tests

1. **Multi-Tab Workflow**
   - Create multiple tabs
   - Paint on each
   - Switch between tabs
   - Verify painting switches correctly

2. **Save/Load Cycle**
   - Paint tabs
   - Save (Ctrl+S)
   - Reload project
   - Verify all tab data restored

3. **Backward Compatibility**
   - Load old project file (no `data` field)
   - Verify tabs initialize with empty data
   - Verify can paint on tabs going forward

## Console Logging

Add `console.log()` calls at key points for debugging:

```typescript
// Tab switch
console.log(`[TAB] Saving painting data for tab ${currentTabId} (${currentTab.data.filter(v => v > 0).length} painted tiles)`);
console.log(`[TAB] Restored painting data for tab ${newTabId} (${newTab.data.filter(v => v > 0).length} painted tiles)`);

// Save
console.log(`[SAVE] Tab ${t.id} (${t.name}): saving ${t.data.filter(v => v > 0).length} painted tiles`);

// Load
console.log(`[LOAD] Tab ${tabId} (${tabName}): restored ${t.data.filter(v => v > 0).length} painted tiles`);
```

Monitor these logs to verify data flow during usage.

## Future Enhancements

1. **Undo/Redo per Tab**
   - Maintain separate undo stacks per tab
   - Currently uses global undo stack

2. **Tab Data Compression**
   - For very large maps, could compress painting data
   - Only save non-zero tiles

3. **Tab Merging**
   - Allow combining paintings from multiple tabs
   - Blend or overlay tab data

4. **Diff/Comparison**
   - Show differences between tab paintings
   - Helpful for comparing variants

---

This architecture ensures each tab is independently persistent while maintaining clean separation of concerns.
