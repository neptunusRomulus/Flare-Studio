import { useCallback, useEffect, useState } from 'react';
import type { ItemRole, ItemResourceSubtype } from '../editor/itemRoles';
import type { RawItem, ItemSummary } from '@/utils/items';

const safeString = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizePathForJoin = (input: string) => input.replace(/\\/g, '/');

const formatLootStringValue = (value: unknown) => {
  if (Array.isArray(value)) return value.map(safeString).join(',');
  return safeString(value);
};

export const serializeLootGroupText = (data: Record<string, unknown>) => {
  const lines: string[] = [];
  const id = safeString(data.id ?? data.name);
  const name = safeString(data.name);
  const description = safeString(data.description);
  const manualLootEntries = Array.isArray(data.loot) ? data.loot as Array<Record<string, unknown>> : data.loot ? [data.loot as Record<string, unknown>] : [];
  const lootContents = data.loot_contents as Record<string, number> | undefined;
  const globalChance = safeString(data.loot_chance_value);
  const globalFixed = data.loot_chance_fixed === true;
  const globalRequiresStatus = safeString(data.requires_status);
  const globalRequiresLevel = safeString(data.requires_level);
  const globalQuantityPerLevel = safeString(data.quantity_per_level);

  if (id) lines.push(`id=${id}`);
  if (name) lines.push(`name=${name}`);
  if (description) lines.push(`description=${description}`);

  const appendLootEntry = (entry: Record<string, unknown>) => {
    const rawStatusLoot = safeString(entry.status_loot);
    if (rawStatusLoot) {
      lines.push(`status_loot=${rawStatusLoot}`);
      lines.push('');
      return;
    }

    const lootId = safeString(entry['loot.id']);
    if (!lootId) return;

    lines.push('[loot]');
    lines.push(`id=${lootId}`);

    const chance = safeString(entry['loot.chance'] ?? (globalFixed ? 'fixed' : globalChance));
    if (chance) lines.push(`chance=${chance}`);

    const quantity = formatLootStringValue(entry['loot.quantity']);
    if (quantity) lines.push(`quantity=${quantity}`);

    const requiresStatus = safeString(entry['loot.requires_status'] ?? globalRequiresStatus);
    if (requiresStatus) lines.push(`requires_status=${requiresStatus}`);

    const requiresLevel = formatLootStringValue(entry['loot.requires_level'] ?? globalRequiresLevel);
    if (requiresLevel) lines.push(`requires_level=${requiresLevel}`);

    const quantityPerLevel = formatLootStringValue(entry['loot.quantity_per_level'] ?? globalQuantityPerLevel);
    if (quantityPerLevel) lines.push(`quantity_per_level=${quantityPerLevel}`);

    lines.push('');
  };

  manualLootEntries.forEach(appendLootEntry);

  if (lootContents) {
    for (const [itemId, quantity] of Object.entries(lootContents)) {
      appendLootEntry({
        'loot.id': itemId,
        'loot.quantity': quantity,
      });
    }
  }

  return lines.join('\n').trim() + '\n';
};

export const parseLootGroupText = (content: string) => {
  const data: Record<string, unknown> = {};
  const lootEntries: Array<Record<string, unknown>> = [];
  let currentEntry: Record<string, unknown> | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    if (line.toLowerCase() === '[loot]') {
      currentEntry = {};
      lootEntries.push(currentEntry);
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex < 0) continue;

    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();

    if (!currentEntry) {
      if (key === 'name') data.name = value;
      else if (key === 'id') data.id = value;
      else if (key === 'description') data.description = value;
      else if (key === 'status_loot') {
        lootEntries.push({ status_loot: value });
      }
      continue;
    }

    if (key === 'id') currentEntry['loot.id'] = value;
    else if (key === 'chance') currentEntry['loot.chance'] = value;
    else if (key === 'quantity') currentEntry['loot.quantity'] = value;
    else if (key === 'requires_status') currentEntry['loot.requires_status'] = value;
    else if (key === 'requires_level') currentEntry['loot.requires_level'] = value;
    else if (key === 'quantity_per_level') currentEntry['loot.quantity_per_level'] = value;
    else if (key === 'status_loot') currentEntry.status_loot = value;
  }

  if (lootEntries.length) data.loot = lootEntries;
  return data;
};

type PendingDuplicate = {
  name: string;
  targetRole: ItemRole;
  conflictRole: ItemRole;
  kind: 'same-role' | 'other-role';
} | null;

type ItemEdit = {
  id: number;
  name: string;
  role: ItemRole;
  resourceSubtype: string | '';
  category: string;
  filePath: string;
  fileName: string;
  [key: string]: string | number | boolean | undefined;
} | null;

type ToastFn = typeof import('@/hooks/use-toast').toast;

export default function useItems({ currentProjectPath, toast, normalizeItemsForState }:
  { currentProjectPath: string | null; toast: ToastFn; normalizeItemsForState: (items: RawItem[]) => ItemSummary[] }) {
  const [itemDialogState, setItemDialogState] = useState<{ name: string; role: ItemRole; resourceSubtype: ItemResourceSubtype } | null>(null);
  const [itemDialogError, setItemDialogError] = useState<string | null>(null);
  const [pendingDuplicateItem, setPendingDuplicateItem] = useState<PendingDuplicate>(null);

  const [itemsList, setItemsList] = useState<ItemSummary[]>([]);
  const [expandedItemCategories, setExpandedItemCategories] = useState<Set<ItemRole>>(new Set());

  const [showItemEditDialog, setShowItemEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEdit>(null);

  const [showLootGroupEditDialog, setShowLootGroupEditDialog] = useState(false);
  const [lootGroupEditingItem, setLootGroupEditingItem] = useState<ItemSummary | null>(null);
  const [lootGroupEditingData, setLootGroupEditingData] = useState<Record<string, unknown> | null>(null);

  const handleOpenItemDialog = useCallback(async () => {
    setItemDialogState({ name: '', role: 'equipment', resourceSubtype: 'material' });
    setItemDialogError(null);
  }, []);

  const handleCloseItemDialog = useCallback(() => {
    setItemDialogState(null);
    setItemDialogError(null);
  }, []);

  const handleItemFieldChange = useCallback((field: 'name' | 'role' | 'resourceSubtype', value: string) => {
    setItemDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setItemDialogError(null);
  }, []);

  const updateLootGroupField = useCallback((key: string, value: unknown) => {
    setLootGroupEditingData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const refreshItemsList = useCallback(async (projectPath: string | null) => {
    if (!projectPath || !window.electronAPI?.listItems) {
      setItemsList([]);
      return;
    }

    try {
      if (window.electronAPI.ensureItemsFolders) {
        await window.electronAPI.ensureItemsFolders(projectPath);
      }
      const itemsResult = await window.electronAPI.listItems(projectPath);
      if (itemsResult.success && itemsResult.items) {
        setItemsList(normalizeItemsForState(itemsResult.items));
      } else {
        setItemsList([]);
      }
    } catch (error) {
      console.error('Failed to load items list:', error);
    }
  }, [normalizeItemsForState]);

  useEffect(() => {
    void (async () => {
      await refreshItemsList(currentProjectPath);
    })();
  }, [currentProjectPath, refreshItemsList]);

  const performCreateItem = useCallback(async (skipDuplicateCheck = false) => {
    if (!itemDialogState) return;
    if (!itemDialogState.name.trim()) {
      setItemDialogError('Item name is required.');
      return;
    }
    if (!currentProjectPath) {
      setItemDialogError('No project path available.');
      return;
    }

    try {
      let latestItems = itemsList;
      if (window.electronAPI?.listItems) {
        const itemsResult = await window.electronAPI.listItems(currentProjectPath);
        if (itemsResult.success && itemsResult.items) {
          latestItems = normalizeItemsForState(itemsResult.items);
          setItemsList(latestItems);
        }
      }

      const selectedCategory = 'Default';
      const selectedRole = itemDialogState.role || 'unspecified';
      const normalizedName = itemDialogState.name.trim().toLowerCase();
      if (!skipDuplicateCheck) {
        const sameCategory = latestItems.find(
            (it) => (it.category || 'Default') === selectedCategory && (it.name || '').trim().toLowerCase() === normalizedName && (it.role || 'unspecified') === selectedRole
          );
        if (sameCategory) {
          setItemDialogError(null);
          setPendingDuplicateItem({ name: itemDialogState.name.trim(), targetRole: selectedRole, conflictRole: selectedRole, kind: 'same-role' });
          return;
        }
        const otherRole = latestItems.find(
          (it) => (it.category || 'Default') === selectedCategory && (it.name || '').trim().toLowerCase() === normalizedName && (it.role || 'unspecified') !== selectedRole
        );
        if (otherRole) {
          setPendingDuplicateItem({ name: itemDialogState.name.trim(), targetRole: selectedRole, conflictRole: otherRole.role || 'unspecified', kind: 'other-role' });
          return;
        }
      }

      let itemId = 1;
      if (window.electronAPI?.getNextItemId) {
        const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
        if (idResult.success) {
          itemId = idResult.nextId;
        }
      }

      if (window.electronAPI?.createItemFile) {
        const payload = { 
          name: itemDialogState.name.trim(), 
          id: itemId, 
          category: selectedCategory,
          role: selectedRole === 'loot_groups' ? 'loot_groups' : selectedRole,
          resourceSubtype: itemDialogState.resourceSubtype
        };
        const result = await window.electronAPI.createItemFile(currentProjectPath, payload as unknown as { name: string; id: number; category?: string; role?: string; resourceSubtype?: string });
        if (result.success) {
          console.log('[DEBUG-ItemSubmit] Item file created:', itemDialogState.name, 'ID:', itemId);
          toast({ title: 'Item Created', description: `${itemDialogState.name} (ID: ${itemId}) has been created.` });
          if (window.electronAPI?.listItems) {
            const itemsResult = await window.electronAPI.listItems(currentProjectPath);
            if (itemsResult.success && itemsResult.items) {
              console.log('[DEBUG-ItemSubmit] Refreshed items list, count:', itemsResult.items.length);
              setItemsList(normalizeItemsForState(itemsResult.items));
              console.log('[DEBUG-ItemSubmit] itemsList state updated');
            }
          }
          handleCloseItemDialog();
        } else if (result.error) {
          setItemDialogError(result.error);
        }
      }
    } catch (err) {
      console.error('Error creating item:', err);
      setItemDialogError('Failed to create item file.');
    }
  }, [itemDialogState, currentProjectPath, toast, normalizeItemsForState, itemsList, handleCloseItemDialog]);

  const handleItemSubmit = useCallback(async () => {
    await performCreateItem(false);
  }, [performCreateItem]);

  const handleConfirmDuplicateItem = useCallback(async () => {
    setPendingDuplicateItem(null);
    await performCreateItem(true);
  }, [performCreateItem]);

  const handleOpenItemEdit = useCallback(async (item: ItemSummary) => {
    const itemRole = (typeof item.role === 'string' ? item.role : 'unspecified') as ItemRole;
    if (itemRole === 'loot_groups') {
      setLootGroupEditingItem(item);
      setLootGroupEditingData(null);
      setShowLootGroupEditDialog(false);

      if (window.electronAPI?.readFile) {
        try {
          const content = await window.electronAPI.readFile(item.filePath);
          if (content) {
            const parsed = parseLootGroupText(content);
            setLootGroupEditingData({ ...parsed, name: parsed.name ?? item.name, id: parsed.id ?? item.name });
          } else {
            setLootGroupEditingData({ name: item.name });
          }
        } catch (err) {
          console.error('Error reading item group file:', err);
          toast({ title: 'Error', description: 'Failed to read item group file.', variant: 'destructive' });
          setLootGroupEditingData({ name: item.name });
        }
      } else if (window.electronAPI?.readItemFile) {
        try {
          const result = await window.electronAPI.readItemFile(item.filePath);
          if (result.success && result.data) {
            const d = result.data as Record<string, unknown>;
            setLootGroupEditingData({ ...d, name: d.name ?? item.name });
          } else {
            setLootGroupEditingData({ name: item.name });
          }
        } catch (err) {
          console.error('Error reading item group file:', err);
          toast({ title: 'Error', description: 'Failed to read item group file.', variant: 'destructive' });
          setLootGroupEditingData({ name: item.name });
        }
      } else {
        setLootGroupEditingData({ name: item.name });
      }

      setShowLootGroupEditDialog(true);
      return;
    }

    if (window.electronAPI?.readItemFile) {
      try {
        const result = await window.electronAPI.readItemFile(item.filePath);
        if (result.success && result.data) {
              const d = result.data as Record<string, unknown>;
          const itemRole = (typeof item.role === 'string' ? item.role : 'unspecified') as ItemRole;
          const isQuestRole = itemRole === 'quest';
          const roleDefaultMaxQuantity = (() => {
            if (itemRole === 'consumable') return 10;
            if (itemRole === 'resource') return 99;
            return 1;
          })();
          setEditingItem({
            id: (typeof d.id === 'number' ? d.id : item.id),
            name: (typeof d.name === 'string' ? d.name : item.name),
            role: itemRole,
            resourceSubtype: (typeof item.resourceSubtype === 'string' ? item.resourceSubtype : '') as ItemResourceSubtype,
            flavor: (typeof d.flavor === 'string' ? d.flavor : ''),
            level: (typeof d.level === 'number' ? d.level : 1),
            icon: (typeof d.icon === 'string' ? d.icon : ''),
            quality: (typeof d.quality === 'string' ? d.quality : ''),
            price: (typeof d.price === 'string' ? d.price : (typeof d.price === 'number' ? String(d.price) : '0')),
            price_per_level: (typeof d.price_per_level === 'string' ? d.price_per_level : (typeof d.price_per_level === 'number' ? String(d.price_per_level) : '')),
            price_sell: (typeof d.price_sell === 'string' ? d.price_sell : (typeof d.price_sell === 'number' ? String(d.price_sell) : '0')),
            max_quantity: (typeof d.max_quantity === 'number' ? d.max_quantity : roleDefaultMaxQuantity),
            quest_item: isQuestRole ? true : (d.quest_item === 'true' || d.quest_item === true),
            no_stash: (typeof d.no_stash === 'string' ? d.no_stash : 'ignore'),
            item_type: (typeof d.item_type === 'string' ? d.item_type : ''),
            type: (typeof d.type === 'string' ? d.type : ''),
            equip_flags: (typeof d.equip_flags === 'string' ? d.equip_flags : ''),
            requires_level: (typeof d.requires_level === 'number' ? d.requires_level : 0),
            requires_stat: (typeof d.requires_stat === 'string' ? d.requires_stat : ''),
            requires_class: (typeof d.requires_class === 'string' ? d.requires_class : ''),
            disable_slots: (typeof d.disable_slots === 'string' ? d.disable_slots : ''),
            gfx: (typeof d.gfx === 'string' ? d.gfx : ''),
            bonus: (typeof d.bonus === 'string' ? d.bonus : ''),
            bonus_power_level: (typeof d.bonus_power_level === 'string' ? d.bonus_power_level : ''),
            dmg: (typeof d.dmg === 'string' ? d.dmg : ''),
            abs: (typeof d.abs === 'string' ? d.abs : ''),
            trait_elemental: (typeof d.trait_elemental === 'string' ? d.trait_elemental : ''),
            power: (typeof d.power === 'string' ? d.power : ''),
            power_desc: (typeof d.power_desc === 'string' ? d.power_desc : ''),
            replace_power: (typeof d.replace_power === 'string' ? d.replace_power : ''),
            script: (typeof d.script === 'string' ? d.script : ''),
            book: (typeof d.book === 'string' ? d.book : ''),
            book_is_readable: d.book_is_readable === 'true' || d.book_is_readable === true,
            soundfx: (typeof d.soundfx === 'string' ? d.soundfx : ''),
            stepfx: (typeof d.stepfx === 'string' ? d.stepfx : ''),
            loot_animation: (typeof d.loot_animation === 'string' ? d.loot_animation : ''),
            randomizer_def: (typeof d.randomizer_def === 'string' ? d.randomizer_def : ''),
            loot_drops_max: (typeof d.loot_drops_max === 'number' ? d.loot_drops_max : 1),
            wall_power: (typeof d.wall_power === 'string' ? d.wall_power : ''),
            use_hazard: d.use_hazard === 'true' || d.use_hazard === true,
            post_power: (typeof d.post_power === 'string' ? d.post_power : ''),
            post_effect: (typeof d.post_effect === 'string' ? d.post_effect : ''),
            speed: (typeof d.speed === 'string' ? d.speed : ''),
            radius: (typeof d.radius === 'string' ? d.radius : ''),
            requires_hpmp_state: (typeof d.requires_hpmp_state === 'string' ? d.requires_hpmp_state : ''),
            requires_item: (typeof d.requires_item === 'string' ? d.requires_item : ''),
            new_state: (typeof d.new_state === 'string' ? d.new_state : ''),
            modifier_damage: (typeof d.modifier_damage === 'string' ? d.modifier_damage : ''),
            lifespan: (typeof d.lifespan === 'string' ? d.lifespan : ''),
            face: d.face === 'true' || d.face === true,
            category: item.category,
            filePath: item.filePath,
            fileName: item.fileName,
          } as ItemEdit);
          setShowItemEditDialog(true);
        } else {
          const fallbackRole = (typeof item.role === 'string' ? item.role : 'unspecified') as ItemRole;
          const fallbackMaxQuantity = (() => {
            if (fallbackRole === 'consumable') return 10;
            if (fallbackRole === 'resource') return 99;
            return 1;
          })();
          setEditingItem({
            id: item.id,
            name: item.name,
            role: fallbackRole,
            resourceSubtype: (typeof item.resourceSubtype === 'string' ? item.resourceSubtype : '') as ItemResourceSubtype,
            flavor: '',
            level: 1,
            icon: '',
            quality: '',
            price: '0',
            price_per_level: '',
            price_sell: '0',
            max_quantity: fallbackMaxQuantity,
            quest_item: item.role === 'quest',
            no_stash: 'ignore',
            item_type: '',
            type: '',
            equip_flags: '',
            requires_level: 0,
            requires_stat: '',
            requires_class: '',
            disable_slots: '',
            gfx: '',
            bonus: '',
            bonus_power_level: '',
            dmg: '',
            abs: '',
            trait_elemental: '',
            power: '',
            power_desc: '',
            replace_power: '',
            script: '',
            book: '',
            book_is_readable: false,
            soundfx: '',
            stepfx: '',
            loot_animation: '',
            randomizer_def: '',
            loot_drops_max: 1,
            wall_power: '',
            use_hazard: false,
            post_power: '',
            post_effect: '',
            speed: '',
            radius: '',
            requires_hpmp_state: '',
            requires_item: '',
            new_state: '',
            modifier_damage: '',
            lifespan: '',
            face: false,
            pickup_status: '',
            category: item.category,
            filePath: item.filePath,
            fileName: item.fileName,
          } as ItemEdit);
          setShowItemEditDialog(true);
        }
      } catch (err) {
        console.error('Error reading item file:', err);
        toast({ title: 'Error', description: 'Failed to read item file.', variant: 'destructive' });
      }
    }
  }, [toast]);

  const handleCreateVendorStockGroup = useCallback(async (
    stockType: 'constant' | 'status' | 'random',
    selectedGroupId: string | null,
    npcName: string,
  ) => {
    if (!currentProjectPath) {
      toast({ title: 'Error', description: 'Unable to create item group: no project path available.', variant: 'destructive' });
      return null;
    }

    const groupLabel = stockType === 'constant' ? 'Constant Stock' : stockType === 'status' ? 'Status Stock' : 'Random Stock';
    const itemName = `${npcName || 'Vendor'} ${groupLabel}`.trim();
    const selectedGroup = selectedGroupId ? itemsList.find((item) => String(item.id) === selectedGroupId) : undefined;
    const category = selectedGroup?.category || 'Default';

    let itemId = 1;
    if (window.electronAPI?.getNextItemId) {
      const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
      if (idResult.success) {
        itemId = idResult.nextId;
      }
    }

    try {
      if (!window.electronAPI?.createItemFile) {
        toast({ title: 'Error', description: 'Filesystem API is unavailable.', variant: 'destructive' });
        return null;
      }

      const payload = {
        name: itemName,
        id: itemId,
        category,
        role: 'loot_groups',
        resourceSubtype: ''
      };
      const result = await window.electronAPI.createItemFile(currentProjectPath, payload as unknown as { name: string; id: number; category?: string; role?: string; resourceSubtype?: string });
      if (!result.success) {
        toast({ title: 'Error', description: result.error || `Failed to create ${groupLabel}.`, variant: 'destructive' });
        return null;
      }

      if (window.electronAPI?.listItems) {
        const itemsResult = await window.electronAPI.listItems(currentProjectPath);
        if (itemsResult.success && itemsResult.items) {
          const normalized = normalizeItemsForState(itemsResult.items);
          setItemsList(normalized);
          const createdItem = normalized.find((item) => item.id === itemId);
          if (createdItem) {
            await handleOpenItemEdit(createdItem);
            return createdItem;
          }
        }
      }

      return null;
    } catch (err) {
      console.error('Error creating vendor stock item group:', err);
      toast({ title: 'Error', description: `Failed to create ${groupLabel}.`, variant: 'destructive' });
      return null;
    }
  }, [currentProjectPath, itemsList, normalizeItemsForState, toast, handleOpenItemEdit]);

  const handleCloseItemEdit = useCallback(() => {
    setShowItemEditDialog(false);
    setEditingItem(null);
  }, []);

  const handleCloseLootGroupEdit = useCallback(() => {
    setShowLootGroupEditDialog(false);
    setLootGroupEditingItem(null);
    setLootGroupEditingData(null);
  }, []);

  const handleSaveLootGroupEdit = useCallback(async () => {
    if (!lootGroupEditingItem || !lootGroupEditingData) return;
    try {
      const id = safeString(lootGroupEditingData.id ?? lootGroupEditingData.name);
      if (!id) {
        toast({ title: 'Error', description: 'Item group must have an ID or name before saving.', variant: 'destructive' });
        return;
      }

      let targetFilePath = safeString(lootGroupEditingItem.filePath);
      const normalizedProjectPath = currentProjectPath ? normalizePathForJoin(currentProjectPath) : null;
      const normalizedId = slugify(id);

      if (!targetFilePath.toLowerCase().endsWith('.txt') || !targetFilePath.includes('/loot/')) {
        if (!normalizedProjectPath || !window.electronAPI?.createFolderIfNotExists || !window.electronAPI?.writeFile) {
          toast({ title: 'Error', description: 'Unable to save item group: missing project path or file APIs.', variant: 'destructive' });
          return;
        }
        const lootFolder = `${normalizedProjectPath}/mods/default/loot`;
        const created = await window.electronAPI.createFolderIfNotExists(lootFolder);
        if (!created) {
          toast({ title: 'Error', description: 'Unable to create loot folder.', variant: 'destructive' });
          return;
        }
        targetFilePath = `${lootFolder}/${normalizedId}.txt`;
      }

      const content = serializeLootGroupText({
        ...lootGroupEditingData,
        id: normalizedId,
        name: safeString(lootGroupEditingData.name ?? lootGroupEditingItem.name),
      });

      if (!window.electronAPI?.writeFile) {
        toast({ title: 'Error', description: 'Filesystem write API is unavailable.', variant: 'destructive' });
        return;
      }

      const saved = await window.electronAPI.writeFile(targetFilePath, content);
      if (saved) {
        toast({ title: 'Item Group Saved', description: `${lootGroupEditingItem.name} has been updated.` });
        handleCloseLootGroupEdit();
      } else {
        toast({ title: 'Error', description: 'Failed to save item group file.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error saving item group:', err);
      toast({ title: 'Error', description: 'Failed to save item group file.', variant: 'destructive' });
    }
  }, [lootGroupEditingItem, lootGroupEditingData, currentProjectPath, toast, handleCloseLootGroupEdit]);

  const handleSaveItemEdit = useCallback(async () => {
    if (!editingItem || !window.electronAPI?.writeItemFile) return;
    const payload = { ...editingItem, item_type: editingItem.role || editingItem.item_type };
    try {
      const result = await window.electronAPI.writeItemFile(editingItem.filePath, payload);
      if (result.success) {
        toast({ title: 'Item Saved', description: `${editingItem.name} has been updated.` });
        if (window.electronAPI?.listItems && currentProjectPath) {
          const itemsResult = await window.electronAPI.listItems(currentProjectPath);
          if (itemsResult.success && itemsResult.items) {
            setItemsList(normalizeItemsForState(itemsResult.items));
          }
        }
        handleCloseItemEdit();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to save item.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error saving item:', err);
      toast({ title: 'Error', description: 'Failed to save item file.', variant: 'destructive' });
    }
  }, [editingItem, currentProjectPath, toast, handleCloseItemEdit, normalizeItemsForState]);

  const updateEditingItemField = useCallback((key: string, value: unknown) => {
    setEditingItem((prev: ItemEdit) => (prev ? { ...prev, [key]: value } as ItemEdit : null));
  }, []);

  return {
    itemsList,
    setItemsList,
    expandedItemCategories,
    setExpandedItemCategories,
    itemDialogState,
    setItemDialogState,
    itemDialogError,
    setItemDialogError,
    pendingDuplicateItem,
    setPendingDuplicateItem,
    refreshItemsList,
    handleOpenItemDialog,
    handleCloseItemDialog,
    handleItemFieldChange,
    performCreateItem,
    handleItemSubmit,
    handleConfirmDuplicateItem,
    handleCreateVendorStockGroup,
    showItemEditDialog,
    setShowItemEditDialog,
    editingItem,
    setEditingItem,
    handleOpenItemEdit,
    handleCloseItemEdit,
    handleSaveItemEdit,
    updateEditingItemField,
    showLootGroupEditDialog,
    lootGroupEditingItem,
    lootGroupEditingData,
    updateLootGroupField,
    handleCloseLootGroupEdit,
    handleSaveLootGroupEdit
  };
}
