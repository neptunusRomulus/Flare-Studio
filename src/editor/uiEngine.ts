/** Parse/serialize UI and platform engine/*.txt files. Empty keys are omitted; comments, APPEND and unknown keys are kept. */

import { parseKeyedValues, upsertKeyedValues } from '@/editor/worldEngine';

export const FONT_SETTINGS_PATH = 'engine/font_settings.txt';
export const FONT_COLORS_PATH = 'engine/font_colors.txt';
export const TOOLTIPS_PATH = 'engine/tooltips.txt';
export const RESOLUTIONS_PATH = 'engine/resolutions.txt';
export const COMBAT_TEXT_PATH = 'engine/combat_text.txt';
export const ICONS_PATH = 'engine/icons.txt';
export const MENU_BACKGROUNDS_PATH = 'engine/menu_backgrounds.txt';
export const MOUSE_CURSOR_PATH = 'engine/mouse_cursor.txt';
export const WIDGET_SETTINGS_PATH = 'engine/widget_settings.txt';
export const DEFAULT_SETTINGS_PATH = 'engine/default_settings.txt';
export const DEFAULT_KEYBINDINGS_PATH = 'engine/default_keybindings.txt';
export const NUMBER_FORMAT_PATH = 'engine/number_format.txt';

export const FONT_COLOR_KEYS = [
  'menu_normal', 'menu_bonus', 'menu_penalty',
  'widget_normal', 'widget_disabled',
  'combat_givedmg', 'combat_takedmg', 'combat_crit', 'combat_buff', 'combat_miss',
  'requirements_not_met', 'item_bonus', 'item_penalty', 'item_flavor',
  'hardcore_color_name',
] as const;

export const TOOLTIP_KEYS = [
  'tooltip_offset', 'tooltip_width', 'tooltip_margin',
  'npc_tooltip_margin', 'tooltip_background_border', 'tooltip_visible_max',
] as const;

export const RESOLUTION_KEYS = [
  'menu_frame_width', 'menu_frame_height', 'icon_size',
  'required_width', 'required_height', 'virtual_height', 'virtual_dpi',
  'ignore_texture_filter',
] as const;

export const COMBAT_TEXT_KEYS = ['duration', 'speed', 'offset', 'fade_duration', 'font'] as const;

export const NUMBER_FORMAT_KEYS = [
  'player_statbar', 'enemy_statbar', 'combat_text', 'character_menu',
  'item_tooltips', 'power_tooltips', 'durations', 'death_penalty',
] as const;

export const MOUSE_CURSOR_KEYS = [
  'normal', 'interact', 'talk', 'attack',
  'lowhp_normal', 'lowhp_interact', 'lowhp_talk', 'lowhp_attack',
] as const;

export const DEFAULT_SETTINGS_KEYS = [
  'fullscreen', 'resolution_w', 'resolution_h', 'music_volume', 'sound_volume',
  'combat_text', 'mouse_move', 'hwsurface', 'vsync', 'texture_filter',
  'dpi_scaling', 'parallax_layers', 'max_fps', 'renderer',
  'enable_joystick', 'joystick_device', 'joystick_deadzone', 'language',
  'change_gamma', 'gamma', 'mouse_aim', 'no_mouse', 'show_fps', 'colorblind',
  'hardware_cursor', 'dev_mode', 'dev_hud', 'loot_tooltips', 'statbar_labels',
  'statbar_autohide', 'auto_equip', 'subtitles', 'minimap_mode',
  'mouse_move_swap', 'mouse_move_attack', 'prev_save_slot',
  'low_hp_warning_type', 'low_hp_threshold', 'item_compare_tips',
  'min_render_size', 'max_render_size', 'touch_controls', 'touch_scale',
  'mute_on_focus_loss', 'pause_on_focus_loss', 'audio_freq',
  'dev_cmd_1', 'dev_cmd_2', 'dev_cmd_3', 'auto_loot', 'joystick_rumble',
  'enable_threaded_image_load', 'fade_walls', 'setup_language', 'setup_mousemove',
] as const;

export const KEYBIND_ACTIONS = [
  'cancel', 'accept', 'up', 'down', 'left', 'right',
  'bar1', 'bar2', 'bar3', 'bar4', 'bar5', 'bar6', 'bar7', 'bar8', 'bar9', 'bar0',
  'main1', 'main2', 'character', 'inventory', 'powers', 'log',
  'equipment_swap', 'equipment_swap_prev', 'minimap_mode', 'loot_tooltip_mode',
  'actionbar', 'menu_page_next', 'menu_page_prev', 'menu_activate',
  'pause', 'cycle_menus', 'aim_up', 'aim_down', 'aim_left', 'aim_right',
  'developer_menu', 'developer_cmd_1', 'developer_cmd_2', 'developer_cmd_3',
] as const;

export const WIDGET_SECTIONS = {
  misc: ['selection_rect_color', 'selection_rect_corner_size', 'colorblind_highlight_offset'],
  tab: ['padding', 'text_padding'],
  slot: ['quantity_label', 'quantity_color', 'quantity_bg_color', 'hotkey_label', 'hotkey_color', 'hotkey_bg_color'],
  listbox: ['text_margin'],
  horizontal_list: ['text_width'],
  scrollbar: ['bg_color'],
  log: ['padding'],
  sound: ['activate'],
} as const;

export type WidgetSectionId = keyof typeof WIDGET_SECTIONS;

export function flareColorToHex(value: string): string {
  const parts = String(value || '').split(',').map((part) => part.trim());
  if (parts.length < 3) return '#000000';
  const rgb = parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, Number(part) || 0)));
  return `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Keep a trailing alpha (or extra components) from the previous Flare color when the swatch changes. */
export function applyHexToFlareColor(hex: string, previous = ''): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return previous;
  const n = Number.parseInt(match[1], 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const extra = String(previous || '').split(',').slice(3).map((part) => part.trim()).filter(Boolean);
  return extra.length ? `${rgb},${extra.join(',')}` : rgb;
}

function trimHeader(lines: string[]): string {
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n');
}

export type FontStyleLine = {
  language: string;
  file: string;
  size: string;
  blend: string;
  extras: string;
};

export type FontEntry = { id: string; styles: FontStyleLine[] };

export function emptyFontStyle(): FontStyleLine {
  return { language: 'default', file: '', size: '', blend: '1', extras: '' };
}

export function emptyFontEntry(): FontEntry {
  return { id: '', styles: [emptyFontStyle()] };
}

export function parseFontStyleLine(value: string): FontStyleLine {
  const parts = String(value || '').split(',').map((part) => part.trim());
  return {
    language: parts[0] || '',
    file: parts[1] || '',
    size: parts[2] || '',
    blend: parts[3] || '',
    extras: parts.slice(4).join(','),
  };
}

export function serializeFontStyleLine(style: FontStyleLine): string {
  const head = [style.language.trim(), style.file.trim(), style.size.trim(), style.blend.trim()];
  const extras = style.extras.trim();
  const line = extras ? [...head, extras].join(',') : head.join(',');
  return line.replace(/,+$/, '');
}

export function parseFontSettings(text: string): { header: string; fonts: FontEntry[] } {
  const header: string[] = [];
  const fonts: FontEntry[] = [];
  let current: FontEntry | null = null;
  let seen = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!seen) {
      if (/^\[font\]$/i.test(line)) {
        seen = true;
        current = emptyFontEntry();
        current.styles = [];
        fonts.push(current);
        continue;
      }
      if (/^\[font_fallback\]$/i.test(line)) {
        seen = true;
        current = null;
        continue;
      }
      header.push(raw);
      continue;
    }
    if (/^\[font\]$/i.test(line)) {
      current = emptyFontEntry();
      current.styles = [];
      fonts.push(current);
      continue;
    }
    if (/^\[/.test(line)) {
      current = null;
      continue;
    }
    if (!line || line.startsWith('#') || !current) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'id') current.id = value;
    else if (key === 'style') current.styles.push(parseFontStyleLine(value));
  }
  return { header: trimHeader(header), fonts };
}

export function serializeFontSettings(file: { header: string; fonts: FontEntry[] }, previous = ''): string {
  const header = file.header || parseFontSettings(previous).header;
  const blocks = file.fonts
    .filter((font) => font.id.trim())
    .map((font) => {
      const lines = ['[font]', `id=${font.id.trim()}`];
      for (const style of font.styles) {
        const value = serializeFontStyleLine(style);
        if (style.language.trim() || style.file.trim()) lines.push(`style=${value}`);
      }
      return lines.join('\n');
    });
  const parts: string[] = [];
  if (header.trim()) parts.push(header.replace(/\n+$/, ''));
  parts.push(...blocks);
  if (!parts.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
}

export type IconSet = { firstId: string; file: string };

export function parseIconsFile(text: string): { header: string; text_offset: string; sets: IconSet[] } {
  const header: string[] = [];
  const sets: IconSet[] = [];
  let text_offset = '';
  let seen = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      if (!seen) header.push(raw);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      if (!seen) header.push(raw);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'icon_set') {
      seen = true;
      const comma = value.indexOf(',');
      sets.push({
        firstId: (comma < 0 ? value : value.slice(0, comma)).trim(),
        file: (comma < 0 ? '' : value.slice(comma + 1)).trim(),
      });
    } else if (key === 'text_offset') {
      seen = true;
      text_offset = value;
    } else if (!seen) {
      header.push(raw);
    }
  }
  return { header: trimHeader(header), text_offset, sets };
}

export function serializeIconsFile(file: { header: string; text_offset: string; sets: IconSet[] }, previous = ''): string {
  const header = file.header || parseIconsFile(previous).header;
  const lines: string[] = [];
  if (header.trim()) lines.push(header.replace(/\n+$/, ''));
  if (file.text_offset.trim()) lines.push(`text_offset=${file.text_offset.trim()}`);
  for (const set of file.sets) {
    if (!set.firstId.trim() && !set.file.trim()) continue;
    lines.push(`icon_set=${set.firstId.trim()},${set.file.trim()}`);
  }
  if (!lines.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export function parseBackgroundsFile(text: string): { header: string; backgrounds: string[] } {
  const header: string[] = [];
  const backgrounds: string[] = [];
  let seen = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      if (!seen) header.push(raw);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      if (!seen) header.push(raw);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'background') {
      seen = true;
      if (value) backgrounds.push(value);
    } else if (!seen) header.push(raw);
  }
  return { header: trimHeader(header), backgrounds };
}

export function serializeBackgroundsFile(file: { header: string; backgrounds: string[] }, previous = ''): string {
  const header = file.header || parseBackgroundsFile(previous).header;
  const lines: string[] = [];
  if (header.trim()) lines.push(header.replace(/\n+$/, ''));
  for (const background of file.backgrounds) {
    if (background.trim()) lines.push(`background=${background.trim()}`);
  }
  if (!lines.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export type WidgetSettingsFile = {
  header: string;
  sections: Record<string, Record<string, string>>;
};

export function emptyWidgetSettings(): WidgetSettingsFile {
  const sections: Record<string, Record<string, string>> = {};
  for (const [name, keys] of Object.entries(WIDGET_SECTIONS)) {
    sections[name] = Object.fromEntries((keys as readonly string[]).map((key) => [key, '']));
  }
  return { header: '', sections };
}

export function parseWidgetSettings(text: string): WidgetSettingsFile {
  const file = emptyWidgetSettings();
  const header: string[] = [];
  let section = '';
  let seen = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      seen = true;
      section = sectionMatch[1].trim();
      if (!file.sections[section]) file.sections[section] = {};
      continue;
    }
    if (!seen) {
      header.push(raw);
      continue;
    }
    if (!line || line.startsWith('#') || !section) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    file.sections[section][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  file.header = trimHeader(header);
  return file;
}

export function serializeWidgetSettings(file: WidgetSettingsFile, previous = ''): string {
  const header = file.header || parseWidgetSettings(previous).header;
  const order = Object.keys(WIDGET_SECTIONS) as WidgetSectionId[];
  const extras = Object.keys(file.sections).filter((name) => !order.includes(name as WidgetSectionId));
  const blocks: string[] = [];
  for (const name of [...order, ...extras]) {
    const values = file.sections[name] || {};
    const known = new Set((WIDGET_SECTIONS as Record<string, readonly string[]>)[name] ?? Object.keys(values));
    const keys = [
      ...((WIDGET_SECTIONS as Record<string, readonly string[]>)[name] ?? []),
      ...Object.keys(values).filter((key) => !known.has(key)),
    ];
    const lines = keys.filter((key) => String(values[key] ?? '').trim()).map((key) => `${key}=${String(values[key]).trim()}`);
    if (!lines.length) continue;
    blocks.push(`[${name}]\n${lines.join('\n')}`);
  }
  const parts: string[] = [];
  if (header.trim()) parts.push(header.replace(/\n+$/, ''));
  parts.push(...blocks);
  if (!parts.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
}

export type KeybindRow = { action: string; value: string };

export type KeybindingsFile = {
  header: string;
  file_version: string;
  binds: KeybindRow[];
  otherSections: string;
};

export function parseKeybindingsFile(text: string): KeybindingsFile {
  const header: string[] = [];
  const binds: KeybindRow[] = [];
  const other: string[] = [];
  let file_version = '';
  let section = '';
  let seenSection = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      seenSection = true;
      section = sectionMatch[1].trim();
      if (section !== 'default') other.push(raw);
      continue;
    }
    if (seenSection && section !== 'default') {
      other.push(raw);
      continue;
    }
    if (!line || line.startsWith('#')) {
      if (!seenSection) header.push(raw);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      if (!seenSection) header.push(raw);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!seenSection && key === 'file_version') {
      file_version = value;
      continue;
    }
    if (!seenSection || section === 'default') {
      if (key === 'file_version') file_version = value;
      else binds.push({ action: key, value });
    }
  }
  while (other.length && other[other.length - 1].trim() === '') other.pop();
  return { header: trimHeader(header), file_version, binds, otherSections: other.join('\n') };
}

export function serializeKeybindingsFile(file: KeybindingsFile, previous = ''): string {
  const parsed = file.header || file.file_version ? file : { ...parseKeybindingsFile(previous), ...file };
  const header = parsed.header;
  const lines: string[] = [];
  if (header.trim()) lines.push(header.replace(/\n+$/, ''));
  const version = (file.file_version || parsed.file_version || '1.12.90').trim();
  if (version) lines.push(`file_version=${version}`);
  const binds = file.binds.filter((row) => row.action.trim() && row.value.trim());
  if (binds.length) {
    lines.push('', '[default]');
    for (const row of binds) lines.push(`${row.action.trim()}=${row.value.trim()}`);
  }
  if (file.otherSections.trim()) {
    lines.push('', file.otherSections.replace(/\n+$/, ''));
  }
  if (!lines.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export { parseKeyedValues, upsertKeyedValues };
