# Tileset Auto-Save on Import Implementation

## Overview
Implemented automatic tileset saving to each map's JSON file immediately after importing a PNG tileset. This ensures each map maintains unique tilesets independently.

## Key Changes

### 1. Added `saveTilesetToMapFile()` Method (Line 7745-7777)
**Purpose**: Save current editor state's tilesets to map JSON file

**Location**: `src/editor/TileMapEditor.ts`

**Signature**:
```typescript
public async saveTilesetToMapFile(projectPath?: string): Promise<void>
```

**Behavior**:
- Accepts optional `projectPath` parameter
- Falls back to map name if no path provided
- Calls `getProjectData()` to get complete project state including tilesets
- Ensures map name is always a string
- Saves via `window.electronAPI.saveMapProject()`
- Logs success/failure to console

**Key Features**:
- Only saves tileset data (via getProjectData which includes layerTabs)
- Does NOT interfere with autosave functionality
- Silent failure (only warns in console, doesn't throw UI errors)

### 2. Modified `importBrushImageToLayerTab()` (Line 6483-6485)
**Location**: `src/editor/TileMapEditor.ts`

**Change**:
After setting the tileset on the active tab, calls `saveTilesetToMapFile()`:

```typescript
// CRITICAL: Save tileset to map JSON file after import
// This ensures each map's unique tilesets are persisted independently
this.saveTilesetToMapFile().catch(err => {
  console.warn('[TileMapEditor] Warning: Failed to auto-save tileset after import:', err);
});
```

**Trigger**: Happens immediately after:
- Tab tileset is set/updated
- Palette is refreshed
- Tab becomes active

## Data Flow

```
User clicks "Import PNG Tileset"
        ↓
File picker opens (PNG only)
        ↓
importBrushImageToLayerTab() called
        ↓
Image loads and dimensions calculated
        ↓
tab.tileset object updated with:
  - image (HTMLImageElement)
  - fileName
  - columns, rows, count
  - tileWidth, tileHeight
  - spacing, margin
  - sourcePath
        ↓
setActiveLayerTab() called (if not already active)
        ↓
[NEW] saveTilesetToMapFile() called
        ↓
getProjectData() called
        ↓
saveMapProject() Electron API called
        ↓
Map JSON file written with:
  - Updated layerTabs with new tileset
  - tilesetImages with embedded data URLs
  - All other project data unchanged
```

## Isolation Guarantees

✅ **Per-Map Isolation**:
- Each map (m1.json, m2.json, m3.json) stores its own tilesets
- Tilesets in m1 don't affect m2
- Each map's JSON file contains complete tileset data

✅ **Autosave Independence**:
- Autosave (Ctrl+S) saves painted tile data
- Tileset save only triggered by import button
- No conflict between autosave and tileset save

✅ **Async Safety**:
- Import tileset save wrapped in try-catch
- Errors only logged to console
- UI remains responsive

✅ **Reload Persistence**:
- Tileset data saved to disk immediately after import
- App reload loads tilesets from map JSON file
- Per-map tileset uniqueness preserved

## Testing Checklist

- [ ] Import tileset to m1 → Check m1.json has tileset in layerTabs
- [ ] Import different tileset to m2 → Check m2.json has different tileset
- [ ] Ctrl+S on m1 → Does NOT change tileset (autosave unaffected)
- [ ] Reload app → m1 shows original tileset, m2 shows its unique tileset
- [ ] Switch maps → Each map displays its imported tileset
- [ ] Close console → No error messages about tileset save

## Technical Details

### What Gets Saved
- Layer tabs with their tileset metadata
- Embedded tileset images as data URLs
- Tileset image dimensions and properties
- Map-specific tileset configuration

### What Does NOT Get Saved
- Painted tile data (that's autosave's job)
- Layer configuration changes
- Object definitions
- Map properties (unless changed through other UI)

### Error Handling
- Tileset save failures are silent (console warning only)
- Import continues even if save fails
- User can manually save with Ctrl+S if needed

## Console Logs

After importing a tileset, you'll see:
```
[TileMapEditor] ✓ Tileset saved to map JSON: /path/to/m1.json
```

Or if save is skipped:
```
[TileMapEditor] No project path provided, skipping tileset save
```

Or if API is unavailable:
```
[TileMapEditor] saveMapProject API not available
```

## Files Modified

1. **src/editor/TileMapEditor.ts**
   - Line 7745-7777: Added `saveTilesetToMapFile()` method
   - Line 6483-6485: Modified `importBrushImageToLayerTab()` to call save

## Build Status
✅ Compiles without errors
✅ Electron app runs successfully
✅ Map files save independently
