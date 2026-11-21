import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  FONT_COLOR_KEYS,
  RESOLUTION_KEYS,
  TOOLTIP_KEYS,
  applyHexToFlareColor,
  flareColorToHex,
  parseBackgroundsFile,
  parseFontSettings,
  parseIconsFile,
  parseKeybindingsFile,
  parseKeyedValues,
  parseWidgetSettings,
  serializeBackgroundsFile,
  serializeFontSettings,
  serializeFontStyleLine,
  serializeIconsFile,
  serializeKeybindingsFile,
  serializeWidgetSettings,
  upsertKeyedValues,
} from './uiEngine';

const DEFAULT = '/home/ism/Projects/Flare/flare-engine/mods/default/engine';
const FANTASY = '/home/ism/Projects/Flare/flare-game/mods/fantasycore/engine';
const GCW0 = '/home/ism/Projects/Flare/flare-engine/mods/gcw0_defaults/engine';

describe('flare colors', () => {
  it('converts rgb and keeps alpha when the swatch changes', () => {
    expect(flareColorToHex('255,64,64')).toBe('#ff4040');
    expect(flareColorToHex('0,0,0,192')).toBe('#000000');
    expect(applyHexToFlareColor('#80ff00', '0,0,0,192')).toBe('128,255,0,192');
    expect(applyHexToFlareColor('#ffffff', '1,2,3')).toBe('255,255,255');
  });
});

describe('font settings', () => {
  it('parses default font_settings and keeps comments on save', () => {
    const text = readFileSync(`${DEFAULT}/font_settings.txt`, 'utf8');
    const parsed = parseFontSettings(text);
    expect(parsed.fonts.map((font) => font.id)).toEqual(['font_regular', 'font_captions', 'font_subtitles']);
    expect(parsed.fonts[0].styles[0]).toMatchObject({
      language: 'default',
      file: 'LiberationSans-Regular.ttf',
      size: '14',
      blend: '1',
    });
    const next = serializeFontSettings(parsed, text);
    expect(next).toContain('# Only .ttf files are supported');
    expect(next).toContain('style=ja,unifont-10.0.06.ttf,14,1');
    expect(parseFontSettings(next).fonts).toEqual(parsed.fonts);
  });

  it('drops nameless fonts and the removed font_fallback section', () => {
    const text = `[font]\nid=\nstyle=default,Empty.ttf,10,1\n\n[font_fallback]\nid=fallback\nstyle=default,Fallback.ttf,10,1\n`;
    const parsed = parseFontSettings(text);
    expect(parsed.fonts.filter((font) => font.id.trim())).toHaveLength(0);
    const next = serializeFontSettings({
      header: '',
      fonts: [{ id: 'font_regular', styles: [{ language: 'default', file: 'A.ttf', size: '12', blend: '1', extras: '1,0,0' }] }],
    }, text);
    expect(next).toContain('style=default,A.ttf,12,1,1,0,0');
    expect(next).not.toContain('font_fallback');
    expect(serializeFontStyleLine({ language: 'en', file: 'A.ttf', size: '12', blend: '1', extras: '' })).toBe('en,A.ttf,12,1');
  });
});

describe('flat UI engine files', () => {
  it('parses font colors and keeps comments when upserting', () => {
    const text = readFileSync(`${DEFAULT}/font_colors.txt`, 'utf8');
    const parsed = parseKeyedValues(text, FONT_COLOR_KEYS);
    expect(parsed.menu_normal).toBe('255,255,255');
    expect(parsed.hardcore_color_name).toBe('255,64,64');
    expect(parsed.combat_crit).toBe('');
    const next = upsertKeyedValues(text, FONT_COLOR_KEYS, { menu_penalty: '200,0,0', combat_crit: '255,255,0' });
    expect(next).toContain('# menus and widgets');
    expect(parseKeyedValues(next, FONT_COLOR_KEYS)).toMatchObject({ menu_penalty: '200,0,0', combat_crit: '255,255,0' });
  });

  it('parses tooltips and resolutions and can omit emptied keys', () => {
    const tooltips = readFileSync(`${DEFAULT}/tooltips.txt`, 'utf8');
    expect(parseKeyedValues(tooltips, TOOLTIP_KEYS)).toMatchObject({
      tooltip_offset: '12',
      tooltip_width: '200',
      tooltip_margin: '4',
      npc_tooltip_margin: '64',
      tooltip_background_border: '',
    });
    const resolutions = readFileSync(`${DEFAULT}/resolutions.txt`, 'utf8');
    const parsed = parseKeyedValues(resolutions, RESOLUTION_KEYS);
    expect(parsed).toMatchObject({
      menu_frame_width: '640',
      icon_size: '32',
      virtual_height: '480,600',
      virtual_dpi: '91.754738',
      ignore_texture_filter: '',
    });
    const next = upsertKeyedValues(resolutions, RESOLUTION_KEYS, { virtual_dpi: '' });
    expect(next).toContain('# Screen and icon resolution settings');
    expect(next).not.toContain('virtual_dpi=');
  });
});

describe('icons, backgrounds, widgets and keybindings', () => {
  it('parses default text_offset and fantasycore icon sets', () => {
    const def = parseIconsFile(readFileSync(`${DEFAULT}/icons.txt`, 'utf8'));
    expect(def).toMatchObject({ text_offset: '2,1', sets: [] });
    const fantasy = parseIconsFile(readFileSync(`${FANTASY}/icons.txt`, 'utf8'));
    expect(fantasy.sets).toEqual([
      { firstId: '0', file: 'images/icons/icons.png' },
      { firstId: '1024', file: 'images/icons/icons_overlay.png' },
    ]);
    const next = serializeIconsFile({ header: fantasy.header, text_offset: '1,1', sets: fantasy.sets }, '');
    expect(next).toContain('text_offset=1,1');
    expect(next).toContain('icon_set=1024,images/icons/icons_overlay.png');
  });

  it('parses menu backgrounds', () => {
    const text = readFileSync(`${FANTASY}/menu_backgrounds.txt`, 'utf8');
    const parsed = parseBackgroundsFile(text);
    expect(parsed.backgrounds).toEqual(['images/menus/backgrounds/dungeon.jpg']);
    expect(serializeBackgroundsFile(parsed, text)).toContain('background=images/menus/backgrounds/dungeon.jpg');
  });

  it('keeps APPEND and widget section keys', () => {
    const text = readFileSync(`${FANTASY}/widget_settings.txt`, 'utf8');
    const parsed = parseWidgetSettings(text);
    expect(parsed.header.trim()).toBe('APPEND');
    expect(parsed.sections.slot.quantity_label).toBe('4,4,left,top,font_slot_quantity');
    expect(parsed.sections.slot.quantity_bg_color).toBe('0,0,0,192');
    expect(parsed.sections.tab.padding).toBe('4,0');
    expect(parsed.sections.sound.activate).toBe('soundfx/widget_activate.ogg');
    const next = serializeWidgetSettings(parsed, text);
    expect(next.startsWith('APPEND')).toBe(true);
    expect(next).toContain('[slot]');
    expect(parseWidgetSettings(next).sections.horizontal_list.text_width).toBe('384');
  });

  it('parses legacy unsectioned keybindings and writes the current [default] format', () => {
    const legacy = `# old\ncancel=27,27,0\naccept=13,13,1\n`;
    const parsed = parseKeybindingsFile(legacy);
    expect(parsed.binds).toEqual([
      { action: 'cancel', value: '27,27,0' },
      { action: 'accept', value: '13,13,1' },
    ]);
    const next = serializeKeybindingsFile(parsed, legacy);
    expect(next).toContain('# old');
    expect(next).toContain('file_version=1.12.90');
    expect(next).toContain('[default]');
    expect(next).toContain('cancel=27,27,0');
  });

  it('round-trips a modern default section and keeps other sections', () => {
    const text = `file_version=1.12.90\n\n[default]\ncancel=SDL:escape,0\naccept=SDL:return,0\n\n[user]\ncancel=-1\n`;
    const parsed = parseKeybindingsFile(text);
    expect(parsed.file_version).toBe('1.12.90');
    expect(parsed.binds).toEqual([
      { action: 'cancel', value: 'SDL:escape,0' },
      { action: 'accept', value: 'SDL:return,0' },
    ]);
    expect(parsed.otherSections).toContain('[user]');
    const next = serializeKeybindingsFile(parsed, text);
    expect(next).toContain('cancel=SDL:escape,0');
    expect(next).toContain('[user]');
    expect(next).toContain('cancel=-1');
  });

  it('preserves unknown default_settings keys such as show_target', () => {
    const text = readFileSync(`${GCW0}/default_settings.txt`, 'utf8');
    const next = upsertKeyedValues(text, ['fullscreen', 'auto_equip'] as const, { fullscreen: '0' });
    expect(next).toContain('show_target=0');
    expect(next).toContain('fullscreen=0');
    expect(next).toContain('auto_equip=1');
  });
});
