/**
 * Flare Engine NPC serialize/deserialize utilities.
 * 
 * Bu modül, FlareNPC modelini Flare'in txt formatına dönüştürür ve
 * txt dosyalarını parse ederek FlareNPC modeline çevirir.
 */

import { FlareNPC, FlareNPCExportResult, DialogueTree } from '../types';

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
  
  // Boş satır
  lines.push('');
  
  // Portrait
  if (npc.portrait) {
    lines.push(`portrait=${npc.portrait}`);
  }
  
  // Boş satır
  lines.push('');
  
  // Vendor ayarları (shop info) - kimlik bilgileri sonrasında
  if (npc.vendor) {
    lines.push(`vendor=true`);
    if (npc.constant_stock) {
      lines.push(`constant_stock=${npc.constant_stock}`);
    }
    if (npc.customProperties?.status_stock_entries) {
      try {
        const entries = JSON.parse(npc.customProperties.status_stock_entries as string);
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (!entry?.requirement || !entry.items) continue;
            const stockStr = Object.entries(entry.items)
              .filter(([, qty]) => (qty as number) > 0)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([id, qty]) => `${id}:${qty}`)
              .join(',');
            if (stockStr) {
              lines.push(`status_stock=${entry.requirement},${stockStr}`);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to serialize status_stock_entries', e);
      }
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
    lines.push('');
  }
  
  // Animation (gfx/animations)
  if (npc.gfx) {
    // Flare'de "animations=" kullanılıyor
    lines.push(`animations=${npc.gfx}`);
  }
  
  // Boş satır
  lines.push('');
  
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
  
  // Custom properties (dialogue trees hariç)
  if (npc.customProperties) {
    for (const [key, value] of Object.entries(npc.customProperties)) {
      // dialogueTrees JSON olarak saklanıyor, ayrıca serialize edilecek
      if (key === 'dialogueTrees') continue;
      lines.push(`${key}=${value}`);
    }
  }
  
  // talker=true (diyaloglardan hemen önce)
  if (npc.talker) {
    lines.push('');
    lines.push(`talker=true`);
  }
  
  // Dialogue Trees serialize
  if (npc.customProperties?.dialogueTrees) {
    try {
      const dialogueTrees: DialogueTree[] = JSON.parse(npc.customProperties.dialogueTrees);
      const dialogueBlocks = serializeDialogueTrees(dialogueTrees);
      if (dialogueBlocks) {
        lines.push(''); // Boş satır ayırıcı
        lines.push(dialogueBlocks);
      }
    } catch (e) {
      console.error('Failed to parse dialogueTrees:', e);
    }
  }
  
  // Boş satırları temizle (ardışık boş satırları tek satıra indir)
  const cleanedLines = lines.reduce((acc: string[], line) => {
    if (line === '' && acc.length > 0 && acc[acc.length - 1] === '') {
      return acc; // ardışık boş satırları atla
    }
    acc.push(line);
    return acc;
  }, []);
  
  // Baştaki ve sondaki boş satırları sil
  while (cleanedLines.length > 0 && cleanedLines[0] === '') cleanedLines.shift();
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') cleanedLines.pop();
  
  return cleanedLines.join('\n');
}

/**
 * DialogueTree array'ini Flare [dialog] bloklarına serialize eder.
 * 
 * Örnek çıktı:
 * [dialog]
 * topic=Talk
 * requires_status=quest_started
 * him=Hello adventurer!
 * you=Tell me about the quest.
 * set_status=quest_accepted
 * reward_xp=100
 */
function serializeDialogueTrees(trees: DialogueTree[]): string {
  const blocks: string[] = [];
  
  for (const tree of trees) {
    // Boş topic'li tree'leri atla
    if (!tree.topic && tree.dialogues.length === 0) continue;
    
    const dialogBlock: string[] = ['[dialog]'];
    
    // Topic
    if (tree.topic) {
      dialogBlock.push(`topic=${tree.topic}`);
    }
    
    // Requirements
    for (const req of tree.requirements) {
      if (!req.value) continue;
      switch (req.type) {
        case 'status':
          dialogBlock.push(`requires_status=${req.value}`);
          break;
        case 'not_status':
          dialogBlock.push(`requires_not_status=${req.value}`);
          break;
        case 'item':
          // Format: item_id:quantity veya sadece item_id
          dialogBlock.push(`requires_item=${req.value}`);
          break;
        case 'level':
          dialogBlock.push(`requires_level=${req.value}`);
          break;
        case 'class':
          dialogBlock.push(`requires_class=${req.value}`);
          break;
      }
    }
    
    // Dialogues (him/her/you)
    for (const dlg of tree.dialogues) {
      if (!dlg.text) continue;
      if (dlg.speaker === 'npc') {
        // Flare'de him veya her kullanılabilir, varsayılan him
        dialogBlock.push(`him=${dlg.text}`);
      } else {
        dialogBlock.push(`you=${dlg.text}`);
      }
    }
    
    // World Effects (set_status, unset_status, teleport, etc.)
    for (const wf of (tree.worldEffects || [])) {
      if (!wf.value) continue;
      switch (wf.type) {
        case 'set_status':
          dialogBlock.push(`set_status=${wf.value}`);
          break;
        case 'unset_status':
          dialogBlock.push(`unset_status=${wf.value}`);
          break;
        case 'teleport':
          // Format: map.txt,x,y
          dialogBlock.push(`intermap=${wf.value}`);
          break;
        case 'spawn':
          dialogBlock.push(`spawn=${wf.value}`);
          break;
        case 'cutscene':
          dialogBlock.push(`cutscene=${wf.value}`);
          break;
        case 'sound':
          dialogBlock.push(`soundfx=${wf.value}`);
          break;
        case 'npc':
          dialogBlock.push(`npc=${wf.value}`);
          break;
      }
    }
    
    // Rewards
    for (const rew of (tree.rewards || [])) {
      if (!rew.value && rew.type !== 'restore') continue;
      switch (rew.type) {
        case 'xp':
          dialogBlock.push(`reward_xp=${rew.value}`);
          break;
        case 'gold':
          dialogBlock.push(`reward_currency=1,${rew.value}`);
          break;
        case 'item': {
          // Format: reward_item=item_id,quantity
          const qty = rew.quantity || 1;
          dialogBlock.push(`reward_item=${rew.value},${qty}`);
          break;
        }
        case 'remove_gold':
          dialogBlock.push(`remove_currency=1,${rew.value}`);
          break;
        case 'remove_item':
          // Format: remove_item=item_id veya remove_item=item_id:quantity
          dialogBlock.push(`remove_item=${rew.value}`);
          break;
        case 'restore':
          dialogBlock.push(`restore=${rew.value || 'all'}`);
          break;
      }
    }
    
    // Sadece [dialog] ve topic varsa atla (içerik yok)
    if (dialogBlock.length > 2 || (dialogBlock.length === 2 && tree.topic)) {
      blocks.push(dialogBlock.join('\n'));
    }
  }
  
  return blocks.join('\n\n');
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
      case 'direction': {
        const dir = parseInt(value, 10);
        if (dir >= 0 && dir <= 7) {
          npc.direction = dir as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
        }
        break;
      }
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
