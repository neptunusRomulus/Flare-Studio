/**
 * Flare Engine NPC serialize/deserialize utilities.
 * 
 * Bu modül, FlareNPC modelini Flare'in txt formatına dönüştürür ve
 * txt dosyalarını parse ederek FlareNPC modeline çevirir.
 */

import { FlareNPC, FlareNPCExportResult } from '../types';

/**
 * Varsayılan NPC değerleri ile yeni bir FlareNPC oluşturur.
 */
export function createDefaultNPC(id: number, x: number = 0, y: number = 0): FlareNPC {
  return {
    id,
    x,
    y,
    filename: `npcs/npc_${id}.txt`,
    name: '',
    talker: true, // Varsayılan olarak konuşmacı
    vendor: false,
  };
}

/**
 * FlareNPC modelini Flare txt formatına serialize eder.
 * 
 * @returns MapSpawnBlock: Map dosyasına eklenecek [npc] bloğu
 *          NpcFileContent: npcs/ klasörüne yazılacak dosya içeriği
 */
export function serializeNpcToFlare(npc: FlareNPC): FlareNPCExportResult {
  const mapSpawnBlock = serializeMapSpawnBlock(npc);
  const npcFileContent = serializeNpcFile(npc);
  
  return {
    mapSpawnBlock,
    npcFileContent,
  };
}

/**
 * Map dosyasına yazılacak [npc] bloğunu oluşturur.
 * 
 * Örnek çıktı:
 * [npc]
 * type=npc
 * location=5,10,1,1
 * filename=npcs/merchant.txt
 * requires_status=quest_intro_complete
 */
function serializeMapSpawnBlock(npc: FlareNPC): string {
  const lines: string[] = ['[npc]', 'type=npc'];
  
  // Location: x,y,w,h (w ve h genellikle 1,1)
  lines.push(`location=${npc.x},${npc.y},1,1`);
  
  // Filename (zorunlu)
  lines.push(`filename=${npc.filename}`);
  
  // Opsiyonel spawn koşulları
  if (npc.requires_status) {
    lines.push(`requires_status=${npc.requires_status}`);
  }
  if (npc.requires_not_status) {
    lines.push(`requires_not_status=${npc.requires_not_status}`);
  }
  if (npc.requires_level !== undefined) {
    lines.push(`requires_level=${npc.requires_level}`);
  }
  if (npc.requires_not_level !== undefined) {
    lines.push(`requires_not_level=${npc.requires_not_level}`);
  }
  if (npc.requires_currency) {
    lines.push(`requires_currency=${npc.requires_currency}`);
  }
  if (npc.requires_not_currency) {
    lines.push(`requires_not_currency=${npc.requires_not_currency}`);
  }
  if (npc.requires_item) {
    lines.push(`requires_item=${npc.requires_item}`);
  }
  if (npc.requires_not_item) {
    lines.push(`requires_not_item=${npc.requires_not_item}`);
  }
  if (npc.requires_class) {
    lines.push(`requires_class=${npc.requires_class}`);
  }
  if (npc.requires_not_class) {
    lines.push(`requires_not_class=${npc.requires_not_class}`);
  }
  
  return lines.join('\n');
}

/**
 * NPC dosyası içeriğini oluşturur (npcs/*.txt).
 * 
 * Örnek çıktı:
 * name=Merchant Bob
 * gfx=animations/npcs/merchant.txt
 * portrait=images/portraits/merchant.png
 * talker=true
 * vendor=true
 * constant_stock=1,2,3,4
 */
function serializeNpcFile(npc: FlareNPC): string {
  const lines: string[] = [];
  
  // Temel bilgiler
  if (npc.name) {
    lines.push(`name=${npc.name}`);
  }
  
  // Görsel
  if (npc.gfx) {
    lines.push(`gfx=${npc.gfx}`);
  }
  if (npc.portrait) {
    lines.push(`portrait=${npc.portrait}`);
  }
  
  // Davranış
  if (npc.talker) {
    lines.push(`talker=true`);
  }
  if (npc.vendor) {
    lines.push(`vendor=true`);
  }
  
  // Vendor ayarları
  if (npc.vendor) {
    if (npc.constant_stock) {
      lines.push(`constant_stock=${npc.constant_stock}`);
    }
    if (npc.random_stock) {
      lines.push(`random_stock=${npc.random_stock}`);
    }
    if (npc.random_stock_count !== undefined) {
      lines.push(`random_stock_count=${npc.random_stock_count}`);
    }
    if (npc.vendor_requires_status) {
      lines.push(`vendor_requires_status=${npc.vendor_requires_status}`);
    }
    if (npc.vendor_requires_not_status) {
      lines.push(`vendor_requires_not_status=${npc.vendor_requires_not_status}`);
    }
  }
  
  // Hareket / AI
  if (npc.direction !== undefined) {
    lines.push(`direction=${npc.direction}`);
  }
  if (npc.waypoints) {
    lines.push(`waypoints=${npc.waypoints}`);
  }
  if (npc.wander_radius !== undefined && npc.wander_radius > 0) {
    lines.push(`wander_radius=${npc.wander_radius}`);
  }
  
  // Custom properties
  if (npc.customProperties) {
    for (const [key, value] of Object.entries(npc.customProperties)) {
      lines.push(`${key}=${value}`);
    }
  }
  
  // TODO: Dialog includes - bunlar genellikle ayrı dialog dosyaları olarak tutulur
  // ve NPC dosyasında include edilir. Şimdilik basit tutuyoruz.
  
  return lines.join('\n');
}

/**
 * Flare NPC dosyasını (npcs/*.txt) parse eder.
 * 
 * @param content NPC txt dosyasının içeriği
 * @param id Editor internal ID
 * @param filename Dosya yolu (ör: "npcs/merchant.txt")
 * @param x Map'teki X pozisyonu
 * @param y Map'teki Y pozisyonu
 */
export function parseNpcFile(
  content: string,
  id: number,
  filename: string,
  x: number,
  y: number
): FlareNPC {
  const npc = createDefaultNPC(id, x, y);
  npc.filename = filename;
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Boş satır veya yorum
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // key=value parse
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    
    switch (key) {
      case 'name':
        npc.name = value;
        break;
      case 'gfx':
        npc.gfx = value;
        break;
      case 'portrait':
        npc.portrait = value;
        break;
      case 'talker':
        npc.talker = value === 'true' || value === '1';
        break;
      case 'vendor':
        npc.vendor = value === 'true' || value === '1';
        break;
      case 'constant_stock':
        npc.constant_stock = value;
        break;
      case 'random_stock':
        npc.random_stock = value;
        break;
      case 'random_stock_count':
        npc.random_stock_count = parseInt(value, 10);
        break;
      case 'vendor_requires_status':
        npc.vendor_requires_status = value;
        break;
      case 'vendor_requires_not_status':
        npc.vendor_requires_not_status = value;
        break;
      case 'direction':
        const dir = parseInt(value, 10);
        if (dir >= 0 && dir <= 7) {
          npc.direction = dir as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
        }
        break;
      case 'waypoints':
        npc.waypoints = value;
        break;
      case 'wander_radius':
        npc.wander_radius = parseInt(value, 10);
        break;
      default:
        // Bilinmeyen attribute'ler customProperties'e eklenir
        if (!npc.customProperties) {
          npc.customProperties = {};
        }
        npc.customProperties[key] = value;
        break;
    }
  }
  
  return npc;
}

/**
 * Map dosyasındaki [npc] bloğunu parse eder.
 * 
 * @param block [npc] bloğunun içeriği (type=npc satırı dahil)
 * @param id Editor internal ID
 */
export function parseNpcSpawnBlock(block: string, id: number): Partial<FlareNPC> {
  const result: Partial<FlareNPC> = { id };
  
  const lines = block.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) {
      continue;
    }
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    
    switch (key) {
      case 'location': {
        const parts = value.split(',').map(p => parseInt(p.trim(), 10));
        if (parts.length >= 2) {
          result.x = parts[0];
          result.y = parts[1];
        }
        break;
      }
      case 'filename':
        result.filename = value;
        break;
      case 'requires_status':
        result.requires_status = value;
        break;
      case 'requires_not_status':
        result.requires_not_status = value;
        break;
      case 'requires_level':
        result.requires_level = parseInt(value, 10);
        break;
      case 'requires_not_level':
        result.requires_not_level = parseInt(value, 10);
        break;
      case 'requires_currency':
        result.requires_currency = value;
        break;
      case 'requires_not_currency':
        result.requires_not_currency = value;
        break;
      case 'requires_item':
        result.requires_item = value;
        break;
      case 'requires_not_item':
        result.requires_not_item = value;
        break;
      case 'requires_class':
        result.requires_class = value;
        break;
      case 'requires_not_class':
        result.requires_not_class = value;
        break;
    }
  }
  
  return result;
}

/**
 * NPC'nin UI'da gösterilecek rol etiketlerini döndürür.
 */
export function getNpcRoleTags(npc: FlareNPC): string[] {
  const tags: string[] = [];
  
  if (npc.talker) {
    tags.push('Talker');
  }
  if (npc.vendor) {
    tags.push('Vendor');
  }
  
  // Quest Giver - Editor-only property
  // Not: Flare Engine'de quest giver bilgisi quest dosyasından gelir (giver=npcs/xxx.txt)
  // Bu property editor'de kullanıcının işaretlemesi içindir, export'ta yorum olarak yazılabilir.
  if (npc.customProperties?.questGiver === 'true') {
    tags.push('Quest');
  }
  
  if (tags.length === 0) {
    tags.push('Static'); // Ne talker ne vendor ne quest - sadece dekoratif
  }
  
  return tags;
}

/**
 * Filename'den NPC dosya adını çıkarır (klasör olmadan).
 */
export function getNpcBaseName(npc: FlareNPC): string {
  const parts = npc.filename.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace('.txt', '');
}
