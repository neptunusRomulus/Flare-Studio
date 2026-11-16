import type { TileLayer, Tool } from '@/types';
import { TileDetector } from '@/editor/tileDetection';
import { debugLog } from '@/lib/debugLog';

export interface BrushOpsHost {
  createTilePalette(preserveOrder?: boolean): void;
  detectedTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>;
  dispatchBrushEvent(action: string, data: number | { from: number; to: number }): void;
  markAsChanged(immediate: boolean): void;
  mergeBrushes(brushIds: number[]): void;
  tileDetector: TileDetector;
  tilesetImage: HTMLImageElement | null;
}

export function mergeBrushes(host: BrushOpsHost, brushIds: number[]): void {
  if (brushIds.length < 2) return;
  
  // Get the tile data for all selected brushes
  const brushesToMerge = brushIds
    .map(id => host.detectedTileData.get(id))
    .filter((brush): brush is NonNullable<typeof brush> => brush !== undefined);
    
  if (brushesToMerge.length !== brushIds.length) {
    throw new Error('Some selected brushes not found');
  }
  
  // Calculate the bounding box that encompasses all selected brushes
  let minX = Number.MAX_SAFE_INTEGER;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxX = Number.MIN_SAFE_INTEGER;
  let maxY = Number.MIN_SAFE_INTEGER;
  
  for (const brush of brushesToMerge) {
    minX = Math.min(minX, brush.sourceX);
    minY = Math.min(minY, brush.sourceY);
    maxX = Math.max(maxX, brush.sourceX + brush.width);
    maxY = Math.max(maxY, brush.sourceY + brush.height);
  }
  
  // Create merged brush data
  const mergedBrushData = {
    sourceX: minX,
    sourceY: minY,
    width: maxX - minX,
    height: maxY - minY
  };
  
  // Convert Map to array to work with positions
  const brushArray = Array.from(host.detectedTileData.entries());
  
  // Find the position of the first selected brush (this will be where the merged brush goes)
  const firstBrushIndex = brushArray.findIndex(([id]) => brushIds.includes(id));
  
  // Remove all selected brushes from the array
  const filteredArray = brushArray.filter(([id]) => !brushIds.includes(id));
  
  // Insert the merged brush at the position of the first selected brush
  filteredArray.splice(firstBrushIndex, 0, [brushIds[0], mergedBrushData]);
  
  // Rebuild the map with sequential IDs
  host.detectedTileData.clear();
  filteredArray.forEach(([_, data], index) => {
    host.detectedTileData.set(index, data);
  });
  
  // Rebuild the tile palette to show the changes
  host.createTilePalette(true);
  
  // Mark as changed to trigger autosave
  host.markAsChanged(true);
  
  debugLog(`Merged ${brushIds.length} brushes into new brush at position ${firstBrushIndex}`);
}

export function separateBrush(host: BrushOpsHost, brushId: number): void {
  debugLog(`separateBrush called with brushId: ${brushId}`);
  
  const brushData = host.detectedTileData.get(brushId);
  if (!brushData) {
    
    throw new Error(`Brush ${brushId} not found`);
  }
  
  debugLog(`Separating brush ${brushId} with data:`, brushData);
  
  // Convert Map to array to work with positions
  const brushArray = Array.from(host.detectedTileData.entries());
  
  // Find the position of the brush to separate
  const brushIndex = brushArray.findIndex(([id]) => id === brushId);
  
  // Remove the original brush from the array
  const filteredArray = brushArray.filter(([id]) => id !== brushId);
  
  // Try to re-detect individual objects within this brush area
  const newBrushes: Array<{sourceX: number, sourceY: number, width: number, height: number}> = [];
  
  if (host.tilesetImage) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = brushData.width;
    tempCanvas.height = brushData.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      // Draw the brush area to analyze
      tempCtx.drawImage(
        host.tilesetImage,
        brushData.sourceX, brushData.sourceY, brushData.width, brushData.height,
        0, 0, brushData.width, brushData.height
      );
      
      const imageData = tempCtx.getImageData(0, 0, brushData.width, brushData.height);
      const data = imageData.data;
      
      debugLog(`Analyzing brush area: ${brushData.width}x${brushData.height}`);
      
      // First, try to find vertical separation lines (gaps between objects)
      const verticalGaps = host.tileDetector.findVerticalGaps(data, brushData.width, brushData.height);
      debugLog(`Found vertical gaps:`, verticalGaps);
      
      if (verticalGaps.length > 0) {
        // Use vertical gaps to separate objects
        let lastX = 0;
        
        for (const gapX of verticalGaps) {
          if (gapX > lastX) {
            const segmentWidth = gapX - lastX;
            const bounds = host.tileDetector.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
            
            if (bounds && bounds.width > 0 && bounds.height > 0) {
              newBrushes.push({
                sourceX: brushData.sourceX + bounds.x,
                sourceY: brushData.sourceY + bounds.y,
                width: bounds.width,
                height: bounds.height
              });
            }
          }
          lastX = gapX + 1; // Skip the gap pixel
        }
        
        // Handle the last segment
        if (lastX < brushData.width) {
          const segmentWidth = brushData.width - lastX;
          const bounds = host.tileDetector.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
          
          if (bounds && bounds.width > 0 && bounds.height > 0) {
            newBrushes.push({
              sourceX: brushData.sourceX + bounds.x,
              sourceY: brushData.sourceY + bounds.y,
              width: bounds.width,
              height: bounds.height
            });
          }
        }
      } else {
        // Fallback to flood fill if no clear vertical gaps
        const visited = new Array(brushData.width * brushData.height).fill(false);
        
        for (let y = 0; y < brushData.height; y++) {
          for (let x = 0; x < brushData.width; x++) {
            const pixelIndex = y * brushData.width + x;
            
            if (visited[pixelIndex] || host.tileDetector.isPixelTransparent(data, x, y, brushData.width)) {
              continue;
            }
            
            debugLog(`Starting flood fill at pixel (${x}, ${y})`);
            const objectData = host.tileDetector.floodFillObjectDataInRegion(
              data, brushData.width, brushData.height, x, y, visited
            );
            
            if (objectData && brushData.width >= 8 && brushData.height >= 8) {
              debugLog(`Found valid connected component:`, objectData);
              // Adjust coordinates back to original image space
              newBrushes.push({
                sourceX: brushData.sourceX + objectData.bounds.x,
                sourceY: brushData.sourceY + objectData.bounds.y,
                width: objectData.bounds.width,
                height: objectData.bounds.height
              });
            } else if (objectData) {
              debugLog(`Found invalid connected component (too small):`, objectData);
            }
          }
        }
      }
    }
  }
  
  debugLog(`Found ${newBrushes.length} new brushes from separation:`, newBrushes);
  
  // Check if we actually found multiple objects
  if (newBrushes.length <= 1) {
    debugLog(`No separation needed - only found ${newBrushes.length} component(s)`);
    return; // Don't separate if we only found one component or none
  }
  
  // Insert the new brushes at the position where the original brush was
  newBrushes.forEach((brushData, index) => {
    filteredArray.splice(brushIndex + index, 0, [brushIndex + index, brushData]);
  });
  
  // Rebuild the map with sequential IDs
  host.detectedTileData.clear();
  filteredArray.forEach(([_, data], index) => {
    host.detectedTileData.set(index, data);
  });
  
  // Rebuild the tile palette to show the changes
  host.createTilePalette(true);
  
  // Mark as changed to trigger autosave
  host.markAsChanged(true);
  
  debugLog(`Separated brush ${brushId} into ${newBrushes.length} new brushes`);
}

export function removeBrush(host: BrushOpsHost, brushId: number): void {
  debugLog(`removeBrush called with brushId: ${brushId}`);
  debugLog(`detectedTileData keys before removal:`, Array.from(host.detectedTileData.keys()));
  
  if (!host.detectedTileData.has(brushId)) {
    
    throw new Error(`Brush ${brushId} not found`);
  }
  
  // Convert Map to array to work with positions
  const brushArray = Array.from(host.detectedTileData.entries());
  debugLog(`brushArray before filtering:`, brushArray.map(([id, _]) => id));
  
  // Remove the brush with the specified ID
  const filteredArray = brushArray.filter(([id]) => id !== brushId);
  debugLog(`filteredArray after filtering:`, filteredArray.map(([id, _]) => id));
  
  // Rebuild the map with sequential IDs
  host.detectedTileData.clear();
  filteredArray.forEach(([_, data], index) => {
    host.detectedTileData.set(index, data);
  });
  
  debugLog(`detectedTileData keys after rebuild:`, Array.from(host.detectedTileData.keys()));
  
  // Rebuild the tile palette to show the changes
  host.createTilePalette(true);
  
  // Mark as changed to trigger autosave
  host.markAsChanged(true);
  
  debugLog(`Removed brush ${brushId}`);
}

export function reorderBrush(host: BrushOpsHost, fromIndex: number, toIndex: number): void {
  // Convert Map to array, reorder, and convert back
  const brushArray = Array.from(host.detectedTileData.entries());
  
  if (fromIndex < 0 || fromIndex >= brushArray.length || toIndex < 0 || toIndex >= brushArray.length) {
    throw new Error('Invalid brush indices for reordering');
  }
  
  const [movedBrush] = brushArray.splice(fromIndex, 1);
  brushArray.splice(toIndex, 0, movedBrush);
  
  // Rebuild the map with new order and reassign IDs sequentially
  host.detectedTileData.clear();
  brushArray.forEach(([_oldId, data], newIndex) => {
    // Use newIndex as the new ID to maintain sequential order
    host.detectedTileData.set(newIndex, data);
  });
  
  // Rebuild the tile palette to reflect the new order
  host.createTilePalette(true);
  
  // Mark as changed to trigger autosave
  host.markAsChanged(true);
  
  debugLog(`Reordered brush from index ${fromIndex} to ${toIndex}`);
}

export function handleBrushMerge(host: BrushOpsHost, tileIndex: number, wrapper: HTMLElement): void {
  // Get all currently selected brushes for merge
  const firstSelected = document.querySelector('.merge-selected-first');
  const secondSelected = document.querySelector('.merge-selected-second');
  
  // If this brush is already selected, deselect it
  if (wrapper.classList.contains('merge-selected-first') || wrapper.classList.contains('merge-selected-second')) {
    wrapper.classList.remove('merge-selected-first', 'merge-selected-second');
    return;
  }
  
  if (!firstSelected) {
    // This is the first selection - add orange stroke
    wrapper.classList.add('merge-selected-first');
  } else if (!secondSelected) {
    // This is the second selection - add orange fill and merge icon.
    // Auto-merge disabled: user must explicitly trigger merge (e.g. via UI button).
    wrapper.classList.add('merge-selected-second');
    // Do not auto-merge here; keep both selections so user can confirm/adjust.
  } else {
    // Already have 2 selected, ignore further selections
    return;
  }
}

export function performMerge(host: BrushOpsHost, firstTileIndex: number, secondTileIndex: number): void {
  debugLog(`Merging tiles ${firstTileIndex} and ${secondTileIndex}`);
  
  try {
    // Call the editor's merge brush method
    host.mergeBrushes([firstTileIndex, secondTileIndex]);
    debugLog(`Successfully merged brushes ${firstTileIndex} and ${secondTileIndex}`);
  } catch (_error) { void _error; }
}

export function handleBrushSeparate(host: BrushOpsHost, tileIndex: number): void {
  host.dispatchBrushEvent('separate', tileIndex);
}

export function handleBrushRemove(host: BrushOpsHost, tileIndex: number): void {
  debugLog(`handleBrushRemove called with tileIndex: ${tileIndex}`);
  host.dispatchBrushEvent('remove', tileIndex);
}

export function dispatchBrushEvent(host: BrushOpsHost, action: string, data: number | { from: number; to: number }): void {
  const event = new CustomEvent('brushAction', {
    detail: typeof data === 'number' ? { action, tileIndex: data } : { action, ...data }
  });
  document.dispatchEvent(event);
}
