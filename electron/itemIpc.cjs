"use strict";

/**
 * Item IPC: the items/ and items/categories/ files plus the item list.
 * Registered from main.cjs; the channel names are part of the preload API and
 * must stay exactly the same.
 */
module.exports = function registerItemIpc({
  ipcMain,
  fs,
  path,
  debugLog,
  flareAdapter,
  rememberProjectRoot,
  isAllowedProjectPath,
}) {
// ============================================================================
// Item helpers
// ============================================================================

/**
 * Parse a category .txt file into an array of parsed items.
 * Each item object carries all key=value pairs found inside its [item] block
 * plus a special `_role` and `_resourceSubtype` field extracted from comment lines.
 */
function parseItemsInCategoryFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf8");
    // Split into blocks: each [item] section
    const blocks = content.split(/\[item\]/i);
    const items = [];
    for (let b = 1; b < blocks.length; b += 1) {
      const block = blocks[b];
      const lines = block.split("\n");
      let item = {};
      for (const line of lines) {
        const trimmed = line.trim();
        // Preserve role/resource info from comment lines that the writer adds above [item]
        const roleMatch = trimmed.match(/^#\s*role=(.+)$/i);
        if (roleMatch) {
          item._role = roleMatch[1].trim().toLowerCase();
          continue;
        }
        const resMatch = trimmed.match(/^#\s*resource_subtype=(.+)$/i);
        if (resMatch) {
          item._resourceSubtype = resMatch[1].trim().toLowerCase();
          continue;
        }
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (key === "id") {
            item.id = parseInt(value, 10) || 0;
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            if (Array.isArray(item[key])) {
              item[key].push(value);
            } else {
              item[key] = [item[key], value];
            }
          } else {
            item[key] = value;
          }
        }
      }
      if (item.id !== undefined) {
        items.push(item);
      }
    }
    return items;
  } catch {
    return [];
  }
}

function appendItemProperty(lines, key, value, options = {}) {
  const { shouldWrite = (v) => v !== undefined && v !== null && v !== "", format = (v) => String(v) } = options;
  const writeValue = (v) => {
    if (shouldWrite(v)) {
      lines.push(`${key}=${format(v)}`);
    }
  };

  if (Array.isArray(value)) {
    for (const itemValue of value) {
      writeValue(itemValue);
    }
    return;
  }

  writeValue(value);
}

function appendItemLines(lines, item) {
  if (item._role) lines.push(`# role=${item._role}`);
  if (item._resourceSubtype) lines.push(`# resource_subtype=${item._resourceSubtype}`);
  appendItemProperty(lines, "id", item.id);
  appendItemProperty(lines, "name", item.name);
  appendItemProperty(lines, "flavor", item.flavor);
  appendItemProperty(lines, "level", item.level, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  appendItemProperty(lines, "icon", item.icon);
  appendItemProperty(lines, "quality", item.quality);
  appendItemProperty(lines, "price", item.price);
  appendItemProperty(lines, "price_per_level", item.price_per_level);
  appendItemProperty(lines, "price_sell", item.price_sell);
  appendItemProperty(lines, "type", item.type);
  appendItemProperty(lines, "speed", item.speed);
  appendItemProperty(lines, "radius", item.radius);
  appendItemProperty(lines, "trait_elemental", item.trait_elemental);
  appendItemProperty(lines, "wall_power", item.wall_power);
  if (item.use_hazard) appendItemProperty(lines, "use_hazard", item.use_hazard, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "post_power", item.post_power);
  appendItemProperty(lines, "post_effect", item.post_effect);
  appendItemProperty(lines, "requires_hpmp_state", item.requires_hpmp_state);
  appendItemProperty(lines, "requires_item", item.requires_item);
  appendItemProperty(lines, "new_state", item.new_state);
  appendItemProperty(lines, "modifier_damage", item.modifier_damage);
  appendItemProperty(lines, "lifespan", item.lifespan);
  if (item.face) appendItemProperty(lines, "face", item.face, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "max_quantity", item.max_quantity, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  if (item.quest_item) appendItemProperty(lines, "quest_item", item.quest_item, { format: () => "true", shouldWrite: (v) => !!v });
  if (item.no_stash) appendItemProperty(lines, "no_stash", item.no_stash, { shouldWrite: (v) => v !== "ignore" });
  appendItemProperty(lines, "item_type", item.item_type);
  appendItemProperty(lines, "equip_flags", item.equip_flags);
  appendItemProperty(lines, "requires_level", item.requires_level, { shouldWrite: (v) => parseInt(v, 10) > 0 });
  appendItemProperty(lines, "requires_stat", item.requires_stat);
  appendItemProperty(lines, "requires_class", item.requires_class);
  appendItemProperty(lines, "disable_slots", item.disable_slots);
  appendItemProperty(lines, "gfx", item.gfx);
  appendItemProperty(lines, "bonus", item.bonus);
  appendItemProperty(lines, "bonus_power_level", item.bonus_power_level);
  appendItemProperty(lines, "dmg", item.dmg);
  appendItemProperty(lines, "abs", item.abs);
  appendItemProperty(lines, "power", item.power);
  appendItemProperty(lines, "power_desc", item.power_desc);
  appendItemProperty(lines, "replace_power", item.replace_power);
  appendItemProperty(lines, "book", item.book);
  if (item.book_is_readable) appendItemProperty(lines, "book_is_readable", item.book_is_readable, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "script", item.script);
  appendItemProperty(lines, "soundfx", item.soundfx);
  appendItemProperty(lines, "stepfx", item.stepfx);
  appendItemProperty(lines, "loot_animation", item.loot_animation);
  appendItemProperty(lines, "randomizer_def", item.randomizer_def);
  appendItemProperty(lines, "loot_drops_max", item.loot_drops_max, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  appendItemProperty(lines, "pickup_status", item.pickup_status);
}

/**
 * Rebuild a category .txt file from a full list of items (all belonging to this category).
 * For each item, writes an optional role comment, then the [item] block with all fields.
 */
function projectPathFromItemFile(filePath) {
  const dir = path.dirname(filePath);
  if (path.basename(dir) === "categories") return path.dirname(path.dirname(dir));
  return path.dirname(dir);
}

function mergePowerFile(projectPath, powers) {
  if (!projectPath || !powers || powers.length === 0) return;
  const file = path.join(projectPath, "powers", "powers.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const fresh = powers.filter((power) => {
    const id = power && power.id != null ? String(power.id) : "";
    if (!id) return true;
    return !new RegExp(`^id=${id}$`, "m").test(existing);
  });
  if (fresh.length === 0) return;
  const block = flareAdapter.exportPowerFile(fresh).replace(/^APPEND\s*\n/, "");
  if (!existing.trim()) {
    fs.writeFileSync(file, flareAdapter.exportPowerFile(fresh), "utf8");
    return;
  }
  const base = /^APPEND\b/m.test(existing) ? existing : flareAdapter.withAppend(existing);
  fs.writeFileSync(file, `${base.endsWith("\n") ? base : `${base}\n`}\n${block}`, "utf8");
}

function writeCategoryFile(filePath, items) {
  const rendered = flareAdapter.exportItemFile(items, { append: true });
  fs.writeFileSync(filePath, rendered.text, "utf8");
  mergePowerFile(projectPathFromItemFile(filePath), rendered.powers);
}

/**
 * Rebuild the top-level items/items.txt index file with INCLUDE directives
 * for each existing category file plus any 'Default' items.
 */
function rebuildItemsIndex(projectPath) {
  const itemsDir = path.join(projectPath, "items");
  const categoriesDir = path.join(itemsDir, "categories");
  if (!fs.existsSync(itemsDir)) return;

  const itemsIndexFile = path.join(itemsDir, "items.txt");
  const defaultItems = fs.existsSync(itemsIndexFile) ? parseItemsInCategoryFile(itemsIndexFile) : [];
  const includes = fs.existsSync(categoriesDir)
    ? fs.readdirSync(categoriesDir).filter((f) => f.toLowerCase().endsWith(".txt")).sort().map((f) => `items/categories/${f}`)
    : [];
  const rendered = flareAdapter.exportItemFile(defaultItems, { append: true, includes });
  fs.writeFileSync(itemsIndexFile, rendered.text, "utf8");
  mergePowerFile(projectPath, rendered.powers);
  debugLog("Rebuilt items index:", itemsIndexFile);
}

/**
 * Ensure items and items/categories folders/file structure exist.
 * Category structure: items/categories/<name>.txt (file, not directory).
 */
ipcMain.handle("ensure-items-folders", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error("Project path is required and must exist");
    }

    const itemsDir = path.join(projectPath, "items");
    const categoriesDir = path.join(itemsDir, "categories");

    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
      debugLog("Created items directory:", itemsDir);
    }

    if (!fs.existsSync(categoriesDir)) {
      fs.mkdirSync(categoriesDir, { recursive: true });
      debugLog("Created items/categories directory:", categoriesDir);
    }

    // Migrate old category directories (items/categories/potions/*.txt) to files
    // (items/categories/potions.txt) so the structure matches Flare conventions.
    if (fs.existsSync(categoriesDir)) {
      const catEntries = fs.readdirSync(categoriesDir, { withFileTypes: true });
      for (const entry of catEntries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(categoriesDir, entry.name);
          const txtPath = path.join(categoriesDir, entry.name + ".txt");
          // Skip if the .txt file already exists
          if (fs.existsSync(txtPath)) {
            debugLog("Category .txt already exists, removing old directory:", dirPath);
            try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
            continue;
          }
          // Collect all [item] blocks from files inside the directory
          const items = [];
          const files = fs.readdirSync(dirPath);
          for (const f of files) {
            if (f.toLowerCase().endsWith(".txt")) {
              const parsed = parseItemsInCategoryFile(path.join(dirPath, f));
              items.push(...parsed);
            }
          }
          if (items.length > 0) {
            // Sort by id
            items.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
            writeCategoryFile(txtPath, items);
            debugLog("Migrated category directory to file:", entry.name, "->", txtPath);
          }
          try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
        }
      }
    }

    // Create qualities.txt file if it doesn't exist
    const qualitiesFile = path.join(itemsDir, "qualities.txt");
    if (!fs.existsSync(qualitiesFile)) {
      const qualitiesContent = `[quality]
id=low
name=Low
color=127,127,127
overlay_icon=1024

[quality]
id=normal
name=Normal
color=255,255,255
overlay_icon=1025

[quality]
id=high
name=High
color=64,255,64
overlay_icon=1026

[quality]
id=epic
name=Epic
color=64,128,255
overlay_icon=1027

[quality]
id=rare
name=Rare
color=160,64,255
overlay_icon=1028

[quality]
id=unique
name=Unique
color=255,192,64
overlay_icon=1029

[quality]
id=one_time_use
name=One-time Use
color=64,255,255
overlay_icon=1030

[quality]
id=currency
name=Currency
color=255,232,156
overlay_icon=1031
`;
      fs.writeFileSync(qualitiesFile, flareAdapter.withAppend(qualitiesContent), "utf8");
      debugLog("Created qualities.txt file:", qualitiesFile);
    }

    // Create / rebuild items.txt index
    rebuildItemsIndex(projectPath);

    return { success: true };
  } catch (error) {
    console.error("Error ensuring items folders:", error);
    return { success: false, error: error.message };
  }
});

// Get item categories (.txt files in items/categories)
ipcMain.handle("get-item-categories", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, categories: ["Default"] };
    }

    const categoriesDir = path.join(projectPath, "items", "categories");
    const categories = ["Default"]; // Default is always first

    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          categories.push(f.replace(/\.txt$/i, ""));
        }
      }
    }

    return { success: true, categories };
  } catch (error) {
    console.error("Error getting item categories:", error);
    return { success: false, error: error.message, categories: ["Default"] };
  }
});

// Create a new item category file
ipcMain.handle(
  "create-item-category",
  async (event, projectPath, categoryName) => {
    try {
      if (!projectPath || !fs.existsSync(projectPath)) {
        throw new Error("Project path is required and must exist");
      }
      if (!categoryName || !categoryName.trim()) {
        throw new Error("Category name is required");
      }

      const sanitize = (input) => {
        return (
          String(input || "")
            .replace(/[<>:"/\\|?*]/g, "_")
            .trim()
            .replace(/\s+/g, "_")
            .replace(/_{2,}/g, "_") || "unnamed_category"
        );
      };

      const sanitizedName = sanitize(categoryName);
      const categoriesDir = path.join(projectPath, "items", "categories");

      // Ensure items/categories exists
      if (!fs.existsSync(categoriesDir)) {
        fs.mkdirSync(categoriesDir, { recursive: true });
      }

      const categoryFile = path.join(categoriesDir, `${sanitizedName}.txt`);

      if (!fs.existsSync(categoryFile)) {
        fs.writeFileSync(categoryFile, "", "utf8");
        debugLog("Created item category file:", categoryFile);
      }

      // Rebuild the main items index
      rebuildItemsIndex(projectPath);

      return {
        success: true,
        categoryName: sanitizedName,
        categoryPath: categoryFile,
      };
    } catch (error) {
      console.error("Error creating item category:", error);
      return { success: false, error: error.message };
    }
  }
);

// Get next item ID by scanning existing items
ipcMain.handle("get-next-item-id", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, nextId: 1 };
    }

    const itemsDir = path.join(projectPath, "items");
    let maxId = 0;

    const scanFile = (filePath) => {
      if (!fs.existsSync(filePath)) return;
      const items = parseItemsInCategoryFile(filePath);
      for (const item of items) {
        if (item.id > maxId) maxId = item.id;
      }
    };

    // Scan all category files
    const categoriesDir = path.join(itemsDir, "categories");
    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          scanFile(path.join(categoriesDir, f));
        }
      }
    }

    // Also scan items.txt for any Default items
    const itemsIndexFile = path.join(itemsDir, "items.txt");
    scanFile(itemsIndexFile);

    return { success: true, nextId: maxId + 1 };
  } catch (error) {
    console.error("Error getting next item ID:", error);
    return { success: true, nextId: 1 };
  }
});

// Create item file — adds a new [item] block to the category .txt file
ipcMain.handle(
  "create-item-file",
  async (event, projectPath, itemData) => {
    try {
      if (!projectPath || !fs.existsSync(projectPath)) {
        throw new Error("Project path is required and must exist");
      }
      if (!itemData || !itemData.name) {
        throw new Error("Item name is required");
      }

      const category = itemData.category || "Default";
      const role = String(itemData.role || "").trim().toLowerCase() || "unspecified";
      const resourceSubtype = String(itemData.resourceSubtype || "").trim().toLowerCase();

      let categoryFilePath;
      if (category === "Default") {
        // Default items live in items.txt (we'll append to it)
        categoryFilePath = path.join(projectPath, "items", "items.txt");
      } else {
        const categoriesDir = path.join(projectPath, "items", "categories");
        if (!fs.existsSync(categoriesDir)) {
          fs.mkdirSync(categoriesDir, { recursive: true });
        }
        categoryFilePath = path.join(categoriesDir, `${category}.txt`);
        if (!fs.existsSync(categoryFilePath)) {
          fs.writeFileSync(categoryFilePath, "", "utf8");
        }
      }

      // Read existing items for this category file
      let existingItems = [];
      if (category === "Default" && fs.existsSync(categoryFilePath)) {
        // For items.txt, we only extract Default items — but since items.txt
        // may have INCLUDE lines, we keep it simple: append-only, no dedup.
        // The file is rewritten below, so we need to read the block we wrote.
        // Actually for Default we need to rebuild items.txt.
        existingItems = parseItemsInCategoryFile(categoryFilePath);
      } else {
        existingItems = parseItemsInCategoryFile(categoryFilePath);
      }

      // Check for duplicate (same name + same role)
      const normalizedName = itemData.name.trim().toLowerCase();
      const isDup = existingItems.some(
        (it) =>
          (it.name || "").toLowerCase() === normalizedName &&
          (it._role || "unspecified") === role
      );
      if (isDup) {
        console.warn("Duplicate item skipped:", normalizedName, role);
        return { success: false, error: `Item "${itemData.name}" already exists in category "${category}" with role "${role}".` };
      }

      // Build the new item object
      const newItem = {
        id: itemData.id,
        name: itemData.name.trim(),
        _role: role,
        ...(resourceSubtype && role === "resource" ? { _resourceSubtype: resourceSubtype } : {}),
        ...(itemData.flavor ? { flavor: itemData.flavor } : {}),
        ...(itemData.level != null ? { level: itemData.level } : {}),
        ...(itemData.icon ? { icon: itemData.icon } : {}),
        ...(itemData.quality ? { quality: itemData.quality } : {}),
        ...(itemData.price != null ? { price: itemData.price } : {}),
        ...(itemData.price_per_level != null ? { price_per_level: itemData.price_per_level } : {}),
        ...(itemData.price_sell != null ? { price_sell: itemData.price_sell } : {}),
        ...(itemData.type ? { type: itemData.type } : {}),
        ...(itemData.speed ? { speed: itemData.speed } : {}),
        ...(itemData.radius ? { radius: itemData.radius } : {}),
        ...(itemData.trait_elemental ? { trait_elemental: itemData.trait_elemental } : {}),
        ...(itemData.wall_power ? { wall_power: itemData.wall_power } : {}),
        ...(itemData.use_hazard ? { use_hazard: "true" } : {}),
        ...(itemData.post_power ? { post_power: itemData.post_power } : {}),
        ...(itemData.post_effect ? { post_effect: itemData.post_effect } : {}),
        ...(itemData.requires_hpmp_state ? { requires_hpmp_state: itemData.requires_hpmp_state } : {}),
        ...(itemData.requires_item ? { requires_item: itemData.requires_item } : {}),
        ...(itemData.new_state ? { new_state: itemData.new_state } : {}),
        ...(itemData.modifier_damage ? { modifier_damage: itemData.modifier_damage } : {}),
        ...(itemData.lifespan ? { lifespan: itemData.lifespan } : {}),
        ...(itemData.face ? { face: "true" } : {}),
        ...(itemData.max_quantity && itemData.max_quantity > 1 ? { max_quantity: itemData.max_quantity } : {}),
        ...(itemData.quest_item ? { quest_item: "true" } : {}),
        ...(itemData.no_stash && itemData.no_stash !== "ignore" ? { no_stash: itemData.no_stash } : {}),
        ...(itemData.item_type ? { item_type: itemData.item_type } : {}),
        ...(itemData.equip_flags ? { equip_flags: itemData.equip_flags } : {}),
        ...(itemData.requires_level && itemData.requires_level > 0 ? { requires_level: itemData.requires_level } : {}),
        ...(itemData.requires_stat ? { requires_stat: itemData.requires_stat } : {}),
        ...(itemData.requires_class ? { requires_class: itemData.requires_class } : {}),
        ...(itemData.disable_slots ? { disable_slots: itemData.disable_slots } : {}),
        ...(itemData.gfx ? { gfx: itemData.gfx } : {}),
        ...(itemData.bonus ? { bonus: itemData.bonus } : {}),
        ...(itemData.bonus_power_level ? { bonus_power_level: itemData.bonus_power_level } : {}),
        ...(itemData.dmg ? { dmg: itemData.dmg } : {}),
        ...(itemData.abs ? { abs: itemData.abs } : {}),
        ...(itemData.power ? { power: itemData.power } : {}),
        ...(itemData.power_desc ? { power_desc: itemData.power_desc } : {}),
        ...(itemData.replace_power ? { replace_power: itemData.replace_power } : {}),
        ...(itemData.book ? { book: itemData.book } : {}),
        ...(itemData.book_is_readable ? { book_is_readable: "true" } : {}),
        ...(itemData.script ? { script: itemData.script } : {}),
        ...(itemData.soundfx ? { soundfx: itemData.soundfx } : {}),
        ...(itemData.stepfx ? { stepfx: itemData.stepfx } : {}),
        ...(itemData.loot_animation ? { loot_animation: itemData.loot_animation } : {}),
        ...(itemData.randomizer_def ? { randomizer_def: itemData.randomizer_def } : {}),
        ...(itemData.loot_drops_max && itemData.loot_drops_max > 1 ? { loot_drops_max: itemData.loot_drops_max } : {}),
        ...(itemData.pickup_status ? { pickup_status: itemData.pickup_status } : {}),
      };

      // Append and rebuild
      existingItems.push(newItem);

      if (category === "Default") {
        rebuildDefaultItems(categoryFilePath, existingItems, projectPath);
      } else {
        writeCategoryFile(categoryFilePath, existingItems);
      }

      // Rebuild the main items index
      rebuildItemsIndex(projectPath);

      debugLog("Item added to category:", itemData.name.trim(), "@", categoryFilePath);
      return {
        success: true,
        filePath: `${categoryFilePath}#item_${itemData.id}`,
        filename: category === "Default" ? "items.txt" : `${category}.txt`,
        categoryFilePath,
      };
    } catch (error) {
      console.error("Error creating item file:", error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Rewrite items/items.txt with Default items embedded and INCLUDE lines for categories.
 * Receives the projectPath so path derivation remains correct.
 */
function rebuildDefaultItems(itemsTxtPath, defaultItems, projectPath) {
  const itemsDir = path.join(projectPath, "items");
  if (!fs.existsSync(itemsDir)) return;

  const categoriesDir = path.join(itemsDir, "categories");
  const includes = fs.existsSync(categoriesDir)
    ? fs.readdirSync(categoriesDir).filter((f) => f.toLowerCase().endsWith(".txt")).sort().map((f) => `items/categories/${f}`)
    : [];
  const rendered = flareAdapter.exportItemFile(defaultItems, { append: true, includes });
  fs.writeFileSync(itemsTxtPath, rendered.text, "utf8");
  mergePowerFile(projectPath, rendered.powers);
}

// List all items in the project
ipcMain.handle("list-items", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, items: [] };
    }

    const itemsDir = path.join(projectPath, "items");
    const categoriesDir = path.join(itemsDir, "categories");
    const items = [];

    /**
     * Read a category .txt, extract every [item] block, return normalized summaries.
     * filePath uses a #item_<id> fragment so the renderer can target the correct item.
     */
    const addItemsFromFile = (filePath, category, categoryFilePath) => {
      const parsed = parseItemsInCategoryFile(filePath);
      for (const item of parsed) {
        items.push({
          id: item.id,
          name: item.name || path.basename(filePath, ".txt"),
          category,
          filePath: `${filePath}#item_${item.id}`,
          fileName: path.basename(categoryFilePath),
          role: item._role || "unspecified",
          resourceSubtype: item._resourceSubtype || "",
        });
      }
    };

    // Scan categories/*.txt
    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          const catName = f.replace(/\.txt$/i, "");
          addItemsFromFile(
            path.join(categoriesDir, f),
            catName,
            `items/categories/${f}`
          );
        }
      }
    }

    // Also scan items.txt for any Default items embedded directly
    const itemsIndexFile = path.join(itemsDir, "items.txt");
    if (fs.existsSync(itemsIndexFile)) {
      addItemsFromFile(itemsIndexFile, "Default", "items/items.txt");
    }

    items.sort((a, b) => a.id - b.id);
    return { success: true, items };
  } catch (error) {
    console.error("Error listing items:", error);
    return { success: false, error: error.message, items: [] };
  }
});

// Read item file and parse all properties
// filePath may include a #item_<id> fragment — strip it to find the real file
ipcMain.handle("read-item-file", async (event, filePath) => {
  try {
    const hashIdx = filePath.indexOf("#");
    const realPath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;
    if (!realPath || !fs.existsSync(realPath)) {
      return { success: false, error: "Item file not found" };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : null;

    const parsed = parseItemsInCategoryFile(realPath);

    if (targetId !== null) {
      // Find the specific item
      const item = parsed.find(i => i.id === targetId);
      if (item) {
        // Convert numeric fields
        if (item.level) item.level = parseInt(item.level, 10) || 1;
        if (item.max_quantity) item.max_quantity = parseInt(item.max_quantity, 10) || 1;
        if (item.requires_level) item.requires_level = parseInt(item.requires_level, 10) || 0;
        if (item.loot_drops_max) item.loot_drops_max = parseInt(item.loot_drops_max, 10) || 1;
        return { success: true, data: item };
      }
      return { success: false, error: `Item with id=${targetId} not found in file` };
    }

    // Fallback: return first item if no fragment provided
    if (parsed.length > 0) {
      return { success: true, data: parsed[0] };
    }

    return { success: false, error: "No items found in file" };
  } catch (error) {
    console.error("Error reading item file:", error);
    return { success: false, error: error.message };
  }
});

// Write item file with all properties
// filePath may include #item_<id> — we update that item inside a multi-item category .txt
ipcMain.handle("write-item-file", async (event, filePath, itemData) => {
  try {
    // Strip the #item_<id> fragment to get the real file path
    const hashIdx = filePath.indexOf("#");
    const categoryFilePath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;
    if (!fs.existsSync(categoryFilePath)) {
      return { success: false, error: `Category file not found: ${categoryFilePath}` };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : (itemData.id != null ? itemData.id : null);

    const existingText = fs.readFileSync(categoryFilePath, "utf8");
    const payload = { ...itemData, id: itemData.id != null ? itemData.id : targetId };
    const merged = flareAdapter.mergeItemText(existingText, payload);
    fs.writeFileSync(categoryFilePath, merged, "utf8");
    const rendered = flareAdapter.exportItemFile([payload], { append: false });
    mergePowerFile(projectPathFromItemFile(categoryFilePath), rendered.powers);
    debugLog("Item saved:", targetId, "@", categoryFilePath);

    return { success: true };
  } catch (error) {
    console.error("Error writing item file:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-item-file", async (event, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: "File path is required" };
    }

    const hashIdx = filePath.indexOf("#");
    const categoryFilePath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;

    if (!fs.existsSync(categoryFilePath)) {
      return { success: false, error: "File does not exist" };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : null;

    if (targetId == null) {
      return { success: false, error: "Cannot delete: no item id in path" };
    }

    const existingItems = parseItemsInCategoryFile(categoryFilePath);
    const filtered = existingItems.filter(i => i.id !== targetId);

    if (filtered.length === 0) {
      // No items left — remove the empty file
      fs.unlinkSync(categoryFilePath);
    } else {
      writeCategoryFile(categoryFilePath, filtered);
    }

    debugLog("Item deleted:", targetId, "@", categoryFilePath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting item file:", error);
    return { success: false, error: error.message };
  }
});
};
