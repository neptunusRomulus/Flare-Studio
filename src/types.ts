// Type definitions for the Isometric Tile Map Editor

export interface TileLayer {
  id: number;
  name: string;
  type: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc' | 'items' | 'rules';
  data: number[];
  visible: boolean;
  transparency?: number; // 0-1, where 1 is fully opaque
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
  // Flare-specific extensions
  category?: string;      // For enemies: antlion, antlion_hatchling, etc.
  level?: number;         // For enemies: difficulty level
  number?: number;        // For enemies: spawn count
  wander_radius?: number; // For enemies: movement range
  activate?: string;      // For events: on_trigger, on_load, etc.
  hotspot?: string;       // For events: location, click, etc.
  intermap?: string;      // For events: map transitions
  loot?: string;          // For events: treasure/loot table
  soundfx?: string;       // For events: sound effects
  mapmod?: string;        // For events: map modifications
  repeat?: boolean;       // For events: can be triggered multiple times
  tooltip?: string;       // For events: hover text
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
  tilesetDefs?: string[]; // For [tilesets] section
}

export interface FlareEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  targetMap?: string;
}

/**
 * Flare Engine NPC modeli.
 * 
 * Flare'de "NPC türü" diye ayrı enum yok - NPC'nin rolü tamamen attribute'lerden gelir:
 * - Konuşmacı NPC: talker=true
 * - Vendor NPC: vendor=true (+ stok alanları)
 * - Quest NPC: talker=true + quest dosyasında giver= referansı (quest dosyasından gelir)
 * 
 * Map dosyasında NPC spawn bilgileri tutulur:
 * - npc.filename=npcs/my_npc.txt
 * - npc.location=x,y
 */
export interface FlareNPC {
  // Editor internal ID (unique within editor session)
  id: number;
  
  // === Map spawn bilgileri (map dosyasına yazılır) ===
  x: number;
  y: number;
  // NPC dosyasının yolu (ör: "npcs/my_npc.txt")
  filename: string;
  // Opsiyonel spawn koşulları
  requires_status?: string;
  requires_not_status?: string;
  requires_level?: number;
  requires_not_level?: number;
  requires_currency?: string; // format: "currency_id,amount"
  requires_not_currency?: string;
  requires_item?: string; // format: "item_id,quantity"
  requires_not_item?: string;
  requires_class?: string;
  requires_not_class?: string;
  
  // === NPC dosyası içeriği (npcs/*.txt dosyasına yazılır) ===
  // Temel bilgiler
  name: string;
  // Görsel
  gfx?: string; // animations/npcs/my_npc.txt
  portrait?: string; // images/portraits/my_npc.png
  
  // Davranış attribute'leri
  talker: boolean; // npc.talker=true → oyuncu konuşabilir
  vendor: boolean; // npc.vendor=true → ticaret yapılabilir
  
  // Vendor ayarları (vendor=true ise)
  constant_stock?: string; // npc.constant_stock=item_id,item_id,...
  random_stock?: string; // npc.random_stock=item_id,item_id,...
  random_stock_count?: number; // kaç random item gösterilecek
  vendor_requires_status?: string;
  vendor_requires_not_status?: string;
  
  // Hareket / AI
  direction?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0=N, 1=NE, 2=E, ... 7=NW
  waypoints?: string; // format: "x1,y1;x2,y2;..."
  wander_radius?: number;
  
  // Diyalog dosyaları (include edilecek txt'ler)
  // TODO: Flare diyalog sistemi ayrı bir modül olarak ele alınabilir
  dialog_includes?: string[];
  
  // Serbest key-value alanlar (bilinmeyen/yeni attribute'ler için)
  customProperties?: Record<string, string>;
}

/**
 * Flare Engine Dialogue Types
 */
export interface DialogueLine {
  id: string;
  speaker: 'npc' | 'player';
  text: string;
}

export interface DialogueRequirement {
  id: string;
  type: 'status' | 'not_status' | 'item' | 'level' | 'class';
  value: string;
}

export interface DialogueReward {
  id: string;
  type: 'xp' | 'gold' | 'item' | 'remove_gold' | 'remove_item' | 'restore';
  value: string;
  quantity?: number;
}

export interface DialogueWorldEffect {
  id: string;
  type: 'set_status' | 'unset_status' | 'teleport' | 'spawn' | 'cutscene' | 'sound' | 'npc';
  value: string;
}

export interface DialogueTree {
  id: string;
  topic: string;
  requirements: DialogueRequirement[];
  dialogues: DialogueLine[];
  rewards: DialogueReward[];
  worldEffects: DialogueWorldEffect[];
  _reqExpanded?: boolean;
  _dlgExpanded?: boolean;
  _rewExpanded?: boolean;
  _wfExpanded?: boolean;
}

/**
 * NPC'yi Flare txt formatına serialize etmek için yardımcı tip.
 * Map dosyası ve NPC dosyası ayrı ayrı export edilir.
 */
export interface FlareNPCExportResult {
  // Map dosyasına eklenecek [npc] bloğu
  mapSpawnBlock: string;
  // npcs/ klasörüne yazılacak NPC dosyası içeriği
  npcFileContent: string;
}

export interface UndoRedoState {
  layerData: number[];
  collisionData: number[];
  objects: MapObject[];
  activeLayerId: number | null;
  timestamp: number;
}


export type Tool = 'tiles' | 'brush' | 'eraser' | 'bucket' | 'selection' | 'shape' | 'eyedropper' | 'stamp' | 'collision' | 'objects';

export type Orientation = 'isometric';

// DOM Element types for better type safety
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

// Stamp-related types
export interface StampTile {
  tileId: number;
  layerId: number;
  x: number;
  y: number;
}

export interface Stamp {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: StampTile[];
  thumbnail?: string; // Base64 encoded image for preview
}

export type StampMode = 'select' | 'create' | 'place';
