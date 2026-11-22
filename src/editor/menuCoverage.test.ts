import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENU_FIELDS } from './menuFields';

type SchemaKey = { key: string; repeatable?: boolean; type?: string };
type SchemaClass = { class: string; file?: string; keys?: SchemaKey[] };

const schema = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../schema/attribute-reference.json'), 'utf8'),
) as { classes: SchemaClass[] };

/** Keys every Menu-derived screen reads through Menu::parseMenuKey. */
const COMMON_KEYS = new Set([
  'pos',
  'align',
  'soundfx_open',
  'soundfx_close',
  'background',
  'enabled',
]);

/** Keys handled by the dedicated action bar and stat bar sections. */
const EXTRA_KEYS: Record<string, string[]> = {
  'actionbar.txt': [
    'slot', 'slot_M1', 'slot_M2', 'char_menu', 'inv_menu', 'powers_menu', 'log_menu',
    'tooltip_length', 'powers_overlap_slots', 'enable_gamepad_nav', 'enable_main2_activate',
  ],
  'hp.txt': [
    'bar_pos', 'text_pos', 'orientation', 'bar_gfx', 'bar_gfx_background', 'hide_timeout',
    'bar_fill_offset', 'bar_fill_size', 'visible_when_empty',
  ],
  'mp.txt': [
    'bar_pos', 'text_pos', 'orientation', 'bar_gfx', 'bar_gfx_background', 'hide_timeout',
    'bar_fill_offset', 'bar_fill_size', 'visible_when_empty',
  ],
  'xp.txt': [
    'bar_pos', 'text_pos', 'orientation', 'bar_gfx', 'bar_gfx_background', 'hide_timeout',
    'bar_fill_offset', 'bar_fill_size', 'visible_when_empty',
  ],
};

/**
 * Keys that need a richer editor than a single value: labels are engine
 * `label` structures, and the rest are repeatable/nested lists. They are
 * preserved on save, but not editable yet. Keep this list shrinking.
 */
/** Engine schema names that differ from the key the parser actually reads. */
const SCHEMA_ALIASES: Record<string, string> = {
  keybinds_bg_color: 'scrollpane_bg_color',
};

const KNOWN_UNSUPPORTED: Record<string, string[]> = {
  'character.txt': ['label_title', 'upgrade_primary', 'label_name', 'label_level', 'label_primary', 'primary', 'unspent', 'show_stat'],
  'inventory.txt': ['set_button', 'set_previous', 'set_next', 'label_equipment_set', 'equipment_slot', 'label_title', 'currency'],
  'vendor.txt': ['label_title'],
  'stash.txt': ['label_title', 'currency', 'tab.name', 'tab.is_private'],
  'minimap.txt': ['text_pos'],
  'gameload.txt': ['slot_number'],
  'confirm.txt': ['label_title'],
  'log.txt': ['label_title'],
  'num_picker.txt': ['label_title'],
  'powers.txt': ['label_title', 'unspent_points'],
  'region_title.txt': ['label_title'],
  'game_over.txt': ['label_title'],
  'enemy.txt': ['text_pos'],
};

function menuFiles(entry: SchemaClass): string[] {
  if (!entry.file) return [];
  return entry.file
    .split(',')
    .map((file) => path.basename(file.trim()))
    .filter((file) => entry.file?.includes('menus/'));
}

describe('menu field coverage', () => {
  it('every engine menu key is either editable or explicitly unsupported', () => {
    const failures: string[] = [];
    for (const entry of schema.classes) {
      for (const file of menuFiles(entry)) {
        const fields = MENU_FIELDS[file] || [];
        const editable = new Set([
          ...COMMON_KEYS,
          ...fields.map((field) => field.key),
          ...(EXTRA_KEYS[file] || []),
          ...(KNOWN_UNSUPPORTED[file] || []),
        ]);
        for (const key of entry.keys || []) {
          const name = SCHEMA_ALIASES[key.key] || key.key;
          if (!editable.has(name)) failures.push(`${file}: ${key.key}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the known-unsupported list honest', () => {
    const stale: string[] = [];
    for (const entry of schema.classes) {
      for (const file of menuFiles(entry)) {
        const keys = new Set((entry.keys || []).map((key) => key.key));
        const fields = MENU_FIELDS[file] || [];
        const editable = new Set([
          ...COMMON_KEYS,
          ...fields.map((field) => field.key),
          ...(EXTRA_KEYS[file] || []),
        ]);
        for (const key of KNOWN_UNSUPPORTED[file] || []) {
          if (!keys.has(key)) stale.push(`${file}: ${key} is no longer in the engine schema`);
          if (editable.has(key)) stale.push(`${file}: ${key} is now editable; remove it from KNOWN_UNSUPPORTED`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});
