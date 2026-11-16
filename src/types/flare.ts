/**
 * Flare engine data model: events, enemies and NPCs as saved into Flare text files.
 */
export interface FlareEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  targetMap?: string;
  type?: string;
  tooltip?: string;
  power?: string;
  power_path?: string;
  power_damage?: number;
  power_stats?: string;
  power_level?: number;
  intermap?: string;
  intermap_id?: number;
  intramap?: number;
  mapmod?: string;
  mapmod_toggle?: boolean;
  soundfx?: string;
  loot?: string;
  loot_count?: number;
  msg?: string;
  shakycam?: boolean;
  requirements?: string;
  reward_xp?: number;
  reward_currency?: string;
  reward_item?: string;
  restore?: string;
  spawn?: string;
  spawn_level?: number;
  stash?: string;
  npc?: string;
  music?: string;
  cutscene?: string;
  repeat?: boolean;
  save_game?: boolean;
  book?: string;
  script?: string;
  chance_exec?: boolean;
  respec?: boolean;
  show_on_minimap?: boolean;
  parallax_layers?: string;
  random_status?: string;
}

/** 
 * Flare Engine Enemy modeli. 
 * Enemy spawn bilgileri map dosyasına [enemy] sections olarak yazılır:
 * - enemy.name=enemy_advanced
 * - enemy.gfx=enemy_advanced.png
 * - enemy.talker=true
 * - enemy.vendor=true (+ stok)
 */
export interface FlareEnemy {
  // Editor internal ID (unique within editor session)
  id: number;

  // === Map spawn bilgileri (map dosyasına yazılır) ===
  x: number;
  y: number;
  width?: number;
  height?: number;
  
  // Enemy properties
  name?: string;
  gfx?: string;
  portrait?: string;
  
  // Optional spawn conditions
  talker?: boolean;
  vendor?: boolean;
  constant_stock?: boolean;
  random_stock?: boolean;
  random_stock_count?: number;
  vendor_requires_: string;
  direction?: number;
  waypoints?: string;
  wander_radius?: number;
  custom_properties?: string;
}

/** 
 * Flare Engine NPC modeli. 
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
  width?: number;
  height?: number;
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
  talker: boolean; // npc.talker=true -> oyuncu konuşabilir
  vendor: boolean; // npc.vendor=true -> ticaret yapılabilir

  // Vendor ayarları (vendor=true ise)
  constant_stock?: string; // npc.constant_stock=item_id,item_id,...
  random_stock?: string; // npc.random_stock=item_id,item_id,...
  random_stock_count?: number | string; // kaç random item gösterilecek, ya da aralık: min,max
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
 * Flare Engine NPC'yi Flare txt formatına serialize etmek için yardımcı tip. 
 * Map dosyası ve NPC dosyası ayrı ayrı export edilir.
 */
export interface FlareNPCExportResult {
  // Map dosyasına eklenecek [npc] bloğu
  mapSpawnBlock: string;
  // npcs/ klasörüne yazılacak NPC dosyası içeriği
  npcFileContent: string;
}
