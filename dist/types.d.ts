export interface TileLayer {
    id: number;
    name: string;
    data: number[];
    visible: boolean;
}
export interface TilesetInfo {
    name: string;
    image: HTMLImageElement;
    columns: number;
    rows: number;
    tileCount: number;
    firstgid: number;
}
export interface MapObject {
    id: number;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties: Record<string, string>;
}
export interface ExportTMXParams {
    mapWidth: number;
    mapHeight: number;
    tileWidth: number;
    tileHeight: number;
    layers: TileLayer[];
    tilesetRef: string | null;
}
export interface ExportTSXParams {
    tileWidth: number;
    tileHeight: number;
    imageWidth: number;
    imageHeight: number;
    tilesetPngName: string;
}
export interface ExportFlareTXTParams {
    mapWidth: number;
    mapHeight: number;
    tileWidth: number;
    tileHeight: number;
    layers: TileLayer[];
    collisionLayer: number[] | null;
    tilesets: TilesetInfo[] | null;
    events: FlareEvent[] | null;
    npcs: FlareNPC[] | null;
    heroPos?: string;
    music?: string;
    title?: string;
}
export interface FlareEvent {
    x: number;
    y: number;
    width: number;
    height: number;
    targetMap?: string;
}
export interface FlareNPC {
    x: number;
    y: number;
    width: number;
    height: number;
    filename?: string;
}
export interface UndoRedoState {
    layerData: number[];
    collisionData: number[];
    objects: MapObject[];
    activeLayerId: number | null;
    timestamp: number;
}
export type Tool = 'tiles' | 'collision' | 'objects';
export type Orientation = 'isometric';
export interface EditorElements {
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
}
//# sourceMappingURL=types.d.ts.map