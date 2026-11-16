import type { TileLayer, Tool, MapObject } from '@/types';
import { canvasToClient, clientToCanvas } from '@/editor/canvasCoords';
import { classifyWheel, pinchFactor } from '@/editor/wheelNav';

export interface PointerInputHost {
  activeStamp: import('@/types').Stamp | null;
  actorDragOrigin: { x: number; y: number } | null;
  actorUsesPlaceholder(object: MapObject): boolean;
  cellRightClickCallback: ((cellX: number, cellY: number, screenX: number, screenY: number) => void) | null;
  clearSelection(): void;
  clickStartX: number;
  clickStartY: number;
  copySelection(): void;
  currentStampMode: 'select' | 'create' | 'place';
  deleteSelection(): void;
  draggingActorId: number | null;
  draggingEventObjectId: number | null;
  draw(): void;
  eventDragOrigin: { x: number; y: number } | null;
  eventEditCallback: ((eventId: number) => void) | null;
  eventToCanvas(event: { clientX: number; clientY: number }): { x: number; y: number };
  fillSelection(): void;
  finishActorDrag(): void;
  finishEventDrag(): void;
  getActiveLayer(): TileLayer | null;
  getDraggableActorAt(x: number, y: number): MapObject | null;
  getObjectsAtPosition(x: number, y: number): MapObject[];
  handleActorDrag(x: number, y: number): void;
  handleEventDrag(x: number, y: number): void;
  handleEyedropper(x: number, y: number): number | null;
  handleSelectionDrag(x: number, y: number): void;
  handleSelectionEnd(): void;
  handleSelectionStart(x: number, y: number, isRightClick: boolean): void;
  handleShapeDrag(x: number, y: number): void;
  handleShapeEnd(): void;
  handleShapeStart(x: number, y: number, isRightClick: boolean): void;
  handleStampClick(x: number, y: number, isRightClick: boolean): void;
  handleTileClick(x: number, y: number, isRightClick: boolean): void;
  hasMovedSinceClick: boolean;
  heroEditCallback: ((currentX: number, currentY: number, mapWidth: number, mapHeight: number, onConfirm: (x: number, y: number) => void) => void) | null;
  heroX: number;
  heroY: number;
  hideObjectTooltip(): void;
  hoverX: number;
  hoverY: number;
  hoveredEventIndex: number;
  isDraggingActor: boolean;
  isDraggingEvent: boolean;
  isDraggingHero: boolean;
  isDrawingShape: boolean;
  isHeroAtPosition(x: number, y: number): boolean;
  isMiddlePanning: boolean;
  isMinimapPanning: boolean;
  isMouseDown: boolean;
  isPanning: boolean;
  isResizingMinimap: boolean;
  isSaveLocked: boolean;
  isSelecting: boolean;
  lastMiniMapBounds: { x: number; y: number; w: number; h: number } | null;
  lastMinimapPanX: number;
  lastMinimapPanY: number;
  lastMinimapResizeX: number;
  lastMinimapResizeY: number;
  lastPanX: number;
  lastPanY: number;
  manualSaveCallback: (() => Promise<void>) | null;
  mapCanvas: HTMLCanvasElement;
  mapHeight: number;
  mapToScreen(mapX: number, mapY: number): { x: number; y: number };
  mapWidth: number;
  minimapPanX: number;
  minimapPanY: number;
  minimapWindowScale: number;
  minimapZoom: number;
  notifyObjectsChanged(): void;
  npcRightClickCallback: ((npcId: number, screenX: number, screenY: number) => void) | null;
  objectEditCallback: ((objectId: number) => void) | null;
  objects: MapObject[];
  openHeroEditDialog(): void;
  pasteSelection(): void;
  placeStamp(gridX: number, gridY: number): void;
  redo(): void;
  saveState(): void;
  screenToTile(screenX: number, screenY: number): { x: number; y: number } | null;
  selectAll(): void;
  selectedObject: MapObject | null;
  selectedObjectId: number | null;
  setHeroPosition(x: number, y: number): void;
  setMinimapWindowScale(scale: number): void;
  setPan(deltaX: number, deltaY: number): void;
  setZoom(newZoom: number): void;
  shapeDrawing: { active: boolean; startX: number; startY: number; endX: number; endY: number; preview: Array<{x: number, y: number}>; };
  showMinimap: boolean;
  showObjectTooltip(object: MapObject, eventCount: number): void;
  spacePressed: boolean;
  stampPreview: { x: number; y: number; width: number; height: number; visible: boolean };
  tool: Tool;
  undo(): void;
  updateCursorForHover(): void;
  updateMapObject(objectId: number, updates: Partial<MapObject>, options?: { recordHistory?: boolean }): boolean;
  zoom: number;
  zoomAtCursor(newZoom: number, cursorX: number, cursorY: number): void;
}

export function handleMouseDown(host: PointerInputHost, event: MouseEvent): void {
  // Prevent editing while save is in progress
  if (host.isSaveLocked) {
    return;
  }

  host.clickStartX = event.clientX;
  host.clickStartY = event.clientY;
  host.hasMovedSinceClick = false;

  const { x, y } = host.eventToCanvas(event);

  // Middle-button drag pans (no Space needed)
  if (event.button === 1) {
    event.preventDefault();
    host.isPanning = true;
    host.isMiddlePanning = true;
    host.lastPanX = x;
    host.lastPanY = y;
    host.mapCanvas.style.cursor = 'grabbing';
    return;
  }

  // Ignore clicks on the minimap
  if (host.showMinimap && host.lastMiniMapBounds) {
    const { x: mapX, y: mapY, w, h } = host.lastMiniMapBounds;
    
    // Check for minimap resizer click (top-left corner, including outer padding)
    const resizerSize = 24;
    if (x >= mapX - 5 && x <= mapX + resizerSize && y >= mapY - 5 && y <= mapY + resizerSize) {
      host.isResizingMinimap = true;
      host.lastMinimapResizeX = x;
      host.lastMinimapResizeY = y;
      return;
    }
    
    if (x >= mapX - 5 && x <= mapX + w + 5 && y >= mapY - 5 && y <= mapY + h + 5) {
      if (host.spacePressed) {
        host.isMinimapPanning = true;
        host.lastMinimapPanX = x;
        host.lastMinimapPanY = y;
        host.mapCanvas.style.cursor = 'grabbing';
      }
      return;
    }
  }

  if (host.spacePressed) {
    // Start panning
    host.isPanning = true;
    host.lastPanX = x;
    host.lastPanY = y;
    host.mapCanvas.style.cursor = 'grabbing';
  } else {
    // Normal tile editing or selection
    host.isMouseDown = true;
    const tileCoords = host.screenToTile(x, y);
    if (tileCoords) {
      // Check if clicking on hero position
      if (host.isHeroAtPosition(tileCoords.x, tileCoords.y)) {
        host.isDraggingHero = true;
        return;
      }

      const actorAtPosition = host.getDraggableActorAt(tileCoords.x, tileCoords.y);
      if (actorAtPosition) {
        // Right-click on NPC/actor - show delete confirmation
        if (event.button === 2 && actorAtPosition.type === 'npc' && host.npcRightClickCallback) {
          host.isMouseDown = false;
          // Get screen position of the actor for popup placement
          const actorScreenPos = host.mapToScreen(actorAtPosition.x, actorAtPosition.y);
          const { x: screenX, y: screenY } = canvasToClient(actorScreenPos.x, actorScreenPos.y, host.mapCanvas);
          host.npcRightClickCallback(actorAtPosition.id, screenX, screenY);
          return;
        }
        
        // Left-click - start dragging
        host.isDraggingActor = true;
        host.draggingActorId = actorAtPosition.id;
        host.actorDragOrigin = { x: actorAtPosition.x, y: actorAtPosition.y };
        host.selectedObject = actorAtPosition;
        host.selectedObjectId = actorAtPosition.id;
        return;
      }

      // Check for event object at this position (single-click to drag/edit)
      const eventsAtPosition = host.objects.filter(
        obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0 &&
          tileCoords.x >= obj.x && tileCoords.x < obj.x + obj.width &&
          tileCoords.y >= obj.y && tileCoords.y < obj.y + obj.height
      );
      if (eventsAtPosition.length > 0 && event.button === 0) {
        // Use hoveredEventIndex to pick the correct event when multiple share a cell
        const idx = eventsAtPosition.length > 1 ? Math.min(host.hoveredEventIndex, eventsAtPosition.length - 1) : 0;
        const eventAtPosition = eventsAtPosition[idx];
        // Start dragging event - single click edit is now handled in mouseup if not dragged
        host.isDraggingEvent = true;
        host.draggingEventObjectId = eventAtPosition.id;
        host.eventDragOrigin = { x: eventAtPosition.x, y: eventAtPosition.y };
        host.selectedObject = eventAtPosition;
        host.selectedObjectId = eventAtPosition.id;
        return;
      }

      if (host.tool === 'tiles') {
        if (event.button === 2 && host.cellRightClickCallback) {
          // Right-click on tile cell - show context menu
          host.isMouseDown = false;
          const screenX = event.clientX;
          const screenY = event.clientY;
          host.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
          return;
        }
        host.handleTileClick(tileCoords.x, tileCoords.y, event.button === 2);
      } else if (host.tool === 'selection') {
        if (event.button === 2 && host.cellRightClickCallback) {
          // Right-click on tile cell - show context menu
          host.isMouseDown = false;
          const screenX = event.clientX;
          const screenY = event.clientY;
          host.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
          return;
        }
        host.handleSelectionStart(tileCoords.x, tileCoords.y, event.button === 2);
      } else if (host.tool === 'shape') {
        if (event.button === 2 && host.cellRightClickCallback) {
          // Right-click on tile cell - show context menu
          host.isMouseDown = false;
          const screenX = event.clientX;
          const screenY = event.clientY;
          host.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
          return;
        }
        host.handleShapeStart(tileCoords.x, tileCoords.y, event.button === 2);
      } else if (host.tool === 'eyedropper') {
        const sampledGid = host.handleEyedropper(tileCoords.x, tileCoords.y);
        if (sampledGid) {
          // Eyedropper was successful, no need to continue with mouse down
          host.isMouseDown = false;
        }
      } else if (host.tool === 'stamp') {
        if (event.button === 2 && host.cellRightClickCallback) {
          // Right-click on tile cell - show context menu
          host.isMouseDown = false;
          const screenX = event.clientX;
          const screenY = event.clientY;
          host.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
          return;
        }
        host.handleStampClick(tileCoords.x, tileCoords.y, event.button === 2);
      }
    }
  }
}

export function handleMouseMove(host: PointerInputHost, event: MouseEvent): void {
  if (host.isMouseDown) {
    const dx = Math.abs(event.clientX - host.clickStartX);
    const dy = Math.abs(event.clientY - host.clickStartY);
    if (dx > 3 || dy > 3) {
      host.hasMovedSinceClick = true;
    }
  }

  const { x, y } = host.eventToCanvas(event);

  if (host.isResizingMinimap) {
    host.mapCanvas.style.cursor = 'nwse-resize';
    // The cursor moving left/up means we are pulling the top-left corner out, increasing the minimap scale
    // The cursor moving right/down means shrinking the minimap.
    // Easiest heuristic: drag distance along the diagonal. Or just take X diff.
    // Actually, standard resize from top-left: dragging left makes it wider. So -deltaX or -deltaY.
    const deltaX = x - host.lastMinimapResizeX;
    const deltaY = y - host.lastMinimapResizeY;
    
    // Compute scaling based on movement. 150px is baseline width.
    // -deltaX increases the width.
    // Minimap width = 150 * scale. 
    // Diff in scale = -deltaX / 150. Average with -deltaY / 120.
    const scaleDiff = ((-deltaX / 150) + (-deltaY / 120)) / 2;
    
    let newScale = host.minimapWindowScale + scaleDiff;
    // Clamp between 0.5 and 3.0 like EngineSettingsDialog
    newScale = Math.max(0.5, Math.min(3.0, newScale));
    
    host.setMinimapWindowScale(newScale);
    
    host.lastMinimapResizeX = x;
    host.lastMinimapResizeY = y;
    
    return;
  }

  if (host.showMinimap && host.lastMiniMapBounds) {
    const { x: mapX, y: mapY } = host.lastMiniMapBounds;
    const resizerSize = 24;
    if (x >= mapX - 5 && x <= mapX + resizerSize && y >= mapY - 5 && y <= mapY + resizerSize) {
      host.mapCanvas.style.cursor = 'nwse-resize';
      // Hide object tooltip if any
      host.hideObjectTooltip();
      return; // Don't do tile hovering logic
    }
  }

  if (host.isMinimapPanning && host.spacePressed) {
    // Handle minimap panning
    const deltaX = x - host.lastMinimapPanX;
    const deltaY = y - host.lastMinimapPanY;
    host.minimapPanX += deltaX;
    host.minimapPanY += deltaY;
    host.lastMinimapPanX = x;
    host.lastMinimapPanY = y;
    host.draw();
    return;
  } else if (host.isPanning && (host.spacePressed || host.isMiddlePanning)) {
    // Handle panning
    const deltaX = x - host.lastPanX;
    const deltaY = y - host.lastPanY;
    host.setPan(deltaX, deltaY);
    host.lastPanX = x;
    host.lastPanY = y;
  } else {
    // Normal hover and tile editing
    const tileCoords = host.screenToTile(x, y);
    if (tileCoords) {
      host.hoverX = tileCoords.x;
      host.hoverY = tileCoords.y;
      
      // Check if there's an object at hover position and update cursor
      host.updateCursorForHover();
      
      // Update stamp preview position
      if (host.tool === 'stamp' && host.currentStampMode === 'place' && host.activeStamp) {
        host.stampPreview.x = tileCoords.x;
        host.stampPreview.y = tileCoords.y;
        host.stampPreview.visible = true;
      }
      
      if (host.isMouseDown && !host.spacePressed) {
        if (host.isDraggingHero) {
          // Update hero position while dragging
          host.setHeroPosition(tileCoords.x, tileCoords.y);
        } else if (host.isDraggingActor) {
          host.handleActorDrag(tileCoords.x, tileCoords.y);
        } else if (host.isDraggingEvent) {
          host.handleEventDrag(tileCoords.x, tileCoords.y);
        } else if (host.tool === 'tiles') {
          host.handleTileClick(tileCoords.x, tileCoords.y, false);
        } else if (host.tool === 'stamp' && host.currentStampMode === 'place' && host.activeStamp) {
          // Allow painting with stamp while dragging (make selection behave like a brush)
          host.placeStamp(tileCoords.x, tileCoords.y);
        } else if (host.isSelecting) {
          host.handleSelectionDrag(tileCoords.x, tileCoords.y);
        } else if (host.isDrawingShape) {
          host.handleShapeDrag(tileCoords.x, tileCoords.y);
        }
      }
    }
  }
  
  host.draw();
}

export function handleMouseUp(host: PointerInputHost): void {
  if (host.isMiddlePanning) {
    host.isMiddlePanning = false;
    host.isPanning = false;
    host.mapCanvas.style.cursor = host.spacePressed ? 'grab' : '';
    return;
  }
  const wasClick = !host.hasMovedSinceClick;

  if (host.isResizingMinimap) {
    host.isResizingMinimap = false;
    return;
  }

  if (host.isSelecting) {
    host.handleSelectionEnd();
  } else if (host.isDrawingShape) {
    host.handleShapeEnd();
  }
  
  // Stop hero dragging
  if (host.isDraggingHero) {
    host.isDraggingHero = false;
    if (wasClick) {
      host.openHeroEditDialog();
    }
  }

  if (host.isDraggingActor) {
    if (wasClick && host.objectEditCallback && host.draggingActorId !== null) {
      host.objectEditCallback(host.draggingActorId);
    }
    host.finishActorDrag();
  }

  if (host.isDraggingEvent) {
    if (wasClick && host.eventEditCallback && host.draggingEventObjectId !== null) {
      host.eventEditCallback(host.draggingEventObjectId);
    }
    host.finishEventDrag();
  }

  if (wasClick && !host.isDraggingHero && !host.isDraggingActor && !host.isDraggingEvent) {
    const activeLayer = host.getActiveLayer();
    const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
    
    if (activeLayer && interactiveLayers.includes(activeLayer.type) && host.hoverX >= 0 && host.hoverY >= 0) {
      const objectsAtPosition = host.getObjectsAtPosition(host.hoverX, host.hoverY);
      // Only trigger generic object edit if it isn't an event (events are handled above because they are implicitly dragged)
      const objectAtMenu = objectsAtPosition.find(obj => obj.x === host.hoverX && obj.y === host.hoverY);
      if (objectAtMenu && host.objectEditCallback && objectAtMenu.type !== 'event') {
        host.objectEditCallback(objectAtMenu.id);
      }
    }
  }

  host.isMouseDown = false;
  host.isPanning = false;
  host.isMinimapPanning = false;
  if (host.isMiddlePanning) {
    host.isMiddlePanning = false;
    host.mapCanvas.style.cursor = host.spacePressed ? 'grab' : '';
  }
}

export function handleMouseLeave(host: PointerInputHost): void {
  // Hide tooltip when mouse leaves canvas
  host.hideObjectTooltip();
  // Reset hover coordinates
  host.hoverX = -1;
  host.hoverY = -1;
  host.finishActorDrag();
  host.finishEventDrag();
  host.isMinimapPanning = false;
  host.isResizingMinimap = false;
  if (host.isMiddlePanning) {
    host.isMiddlePanning = false;
    host.isPanning = false;
    host.mapCanvas.style.cursor = '';
  }
  host.draw();
}

export function handleWheel(host: PointerInputHost, event: WheelEvent): void {
  event.preventDefault();

  const { x: cursorX, y: cursorY } = host.eventToCanvas(event);
  const wheelKind = classifyWheel(event);

  // Check if hovering over minimap
  if (host.showMinimap && host.lastMiniMapBounds) {
    const { x, y, w, h } = host.lastMiniMapBounds;
    if (cursorX >= x && cursorX <= x + w && cursorY >= y && cursorY <= y + h) {
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      // Clamp minimap internal zoom to reasonable values (e.g. 0.25x to 4.0x)
      host.minimapZoom = Math.max(0.25, Math.min(4.0, host.minimapZoom * zoomFactor));
      host.draw();
      return; // Consume wheel event for minimap zoom
    }
  }
  
  // Touchpad two-finger scroll pans the canvas
  if (wheelKind === 'pan') {
    host.setPan(-event.deltaX / host.zoom, -event.deltaY / host.zoom);
    return;
  }
  // Pinch (ctrl+wheel) zooms smoothly around the cursor
  if (wheelKind === 'pinch') {
    host.zoomAtCursor(host.zoom * pinchFactor(event.deltaY), cursorX, cursorY);
    return;
  }

  // Check if hovering over a cell with multiple events – scroll to cycle
  if (host.hoverX >= 0 && host.hoverY >= 0) {
    const eventsAtHover = host.objects.filter(
      obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0 &&
        host.hoverX >= obj.x && host.hoverX < obj.x + obj.width &&
        host.hoverY >= obj.y && host.hoverY < obj.y + obj.height
    );
    if (eventsAtHover.length > 1) {
      if (event.deltaY > 0) {
        host.hoveredEventIndex = (host.hoveredEventIndex + 1) % eventsAtHover.length;
      } else {
        host.hoveredEventIndex = (host.hoveredEventIndex - 1 + eventsAtHover.length) % eventsAtHover.length;
      }
      host.showObjectTooltip(eventsAtHover[host.hoveredEventIndex], eventsAtHover.length);
      return;
    }
  }

  // Default: modify main canvas zoom
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  host.setZoom(host.zoom * zoomFactor);
}

export function handleKeyDown(host: PointerInputHost, event: KeyboardEvent): void {
  // Don't capture keyboard events if user is typing in an input/textarea
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    host.spacePressed = true;
    host.mapCanvas.style.cursor = 'grab';
  }

  const isEnterShortcut = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
  if (isEnterShortcut) {
    event.preventDefault();
    host.fillSelection();
    return;
  }
  
  // Undo/Redo shortcuts
  if (event.ctrlKey || event.metaKey) {
    switch (event.code) {
      case 'KeyZ':
        event.preventDefault();
        if (event.shiftKey) {
          // Ctrl+Shift+Z = Redo (alternative)
          host.redo();
        } else {
          // Ctrl+Z = Undo
          host.undo();
        }
        break;
      case 'KeyY':
        // Ctrl+Y = Redo
        event.preventDefault();
        host.redo();
        break;
      case 'KeyS':
        // Ctrl+S = Manual Save
        event.preventDefault();
        if (host.manualSaveCallback) {
          host.manualSaveCallback().catch(_err => {
            // save error handled elsewhere
          });
        }
        break;
      case 'KeyA':
        event.preventDefault();
        host.selectAll();
        break;
      case 'KeyC':
        event.preventDefault();
        host.copySelection();
        break;
      case 'KeyV':
        event.preventDefault();
        host.pasteSelection();
        break;
    }
  }
  
  // Other shortcuts
  switch (event.code) {
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      host.deleteSelection();
      break;
    case 'Escape':
      event.preventDefault();
      host.clearSelection();
      // Also cancel shape drawing if in progress
      if (host.isDrawingShape) {
        host.shapeDrawing.active = false;
        host.isDrawingShape = false;
        host.shapeDrawing.preview = [];
        host.draw();
      }
      break;
  }
}

export function handleKeyUp(host: PointerInputHost, event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
    host.spacePressed = false;
    host.isPanning = false;
    host.isMinimapPanning = false;
    host.mapCanvas.style.cursor = 'crosshair';
  }
}

export function getDraggableActorAt(host: PointerInputHost, x: number, y: number): MapObject | null {
  if (x < 0 || y < 0) return null;
  return host.objects.find(obj => obj.x === x && obj.y === y && host.actorUsesPlaceholder(obj)) || null;
}

export function handleActorDrag(host: PointerInputHost, x: number, y: number): void {
  if (!host.isDraggingActor || host.draggingActorId === null) return;
  if (x < 0 || y < 0 || x >= host.mapWidth || y >= host.mapHeight) return;

  const actor = host.objects.find(obj => obj.id === host.draggingActorId);
  if (!actor) return;
  if (actor.x === x && actor.y === y) return;

  // Stay on the last free tile; cursor feedback is applied in updateCursorForHover.
  if (actor.type === 'npc') {
    const conflict = host.objects.find(obj => obj.type === 'npc' && obj.id !== actor.id && obj.x === x && obj.y === y);
    if (conflict) return;
  }

  host.updateMapObject(actor.id, { x, y }, { recordHistory: false });
}

export function handleEventDrag(host: PointerInputHost, x: number, y: number): void {
  if (!host.isDraggingEvent || host.draggingEventObjectId === null) return;
  if (x < 0 || y < 0 || x >= host.mapWidth || y >= host.mapHeight) return;

  const ev = host.objects.find(obj => obj.id === host.draggingEventObjectId);
  if (!ev) return;
  if (ev.x === x && ev.y === y) return;

  // Update position and recalculate location property
  const updates: Partial<MapObject> = { x, y };
  const props = { ...ev.properties };
  if (props.location) {
    props.location = `${x},${y},${ev.width},${ev.height}`;
  }
  if (props.hotspot) {
    // Keep hotspot relative: reset to event origin
    props.hotspot = `${x},${y},${ev.width},${ev.height}`;
  }
  updates.properties = props;
  host.updateMapObject(ev.id, updates, { recordHistory: false });
}

export function finishActorDrag(host: PointerInputHost): void {
  if (!host.isDraggingActor) return;
  const id = host.draggingActorId;
  const origin = host.actorDragOrigin;
  host.isDraggingActor = false;
  host.draggingActorId = null;
  host.actorDragOrigin = null;
  if (id == null || !origin) return;
  const actor = host.objects.find(obj => obj.id === id);
  if (actor && (actor.x !== origin.x || actor.y !== origin.y)) {
    host.saveState();
    host.notifyObjectsChanged();
  }
}

export function finishEventDrag(host: PointerInputHost): void {
  if (!host.isDraggingEvent) return;
  const id = host.draggingEventObjectId;
  const origin = host.eventDragOrigin;
  host.isDraggingEvent = false;
  host.draggingEventObjectId = null;
  host.eventDragOrigin = null;
  if (id == null || !origin) return;
  const ev = host.objects.find(obj => obj.id === id);
  if (ev && (ev.x !== origin.x || ev.y !== origin.y)) {
    host.saveState();
    host.notifyObjectsChanged();
  }
}

export function openHeroEditDialog(host: PointerInputHost): void {
  if (host.heroEditCallback) {
    host.heroEditCallback(
      host.heroX,
      host.heroY,
      host.mapWidth,
      host.mapHeight,
      (x: number, y: number) => {
        host.setHeroPosition(x, y);
      }
    );
  } else {
    // Fallback to alert if no callback is set
    alert(`Hero position: (${host.heroX}, ${host.heroY}). Set up hero edit dialog in React component.`);
  }
}
