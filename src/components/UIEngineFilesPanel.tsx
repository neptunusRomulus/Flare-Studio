import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import FontLibrary, { FONT_FILE_LIST_ID } from '@/components/engine/FontLibrary';
import SubtitlesForm from '@/components/engine/SubtitlesForm';
import { FlareColorField } from '@/components/ui/flare-color-field';
import { toast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { writeProjectFiles } from '@/editor/projectFiles';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
import type { FieldWidth } from '@/components/ui/fieldWidth';
import { SUBTITLES_PATH } from '@/editor/subtitlesFile';
import {
  COMBAT_TEXT_KEYS,
  COMBAT_TEXT_PATH,
  DEFAULT_KEYBINDINGS_PATH,
  DEFAULT_SETTINGS_KEYS,
  DEFAULT_SETTINGS_PATH,
  FONT_COLORS_PATH,
  FONT_COLOR_KEYS,
  FONT_SETTINGS_PATH,
  ICONS_PATH,
  MENU_BACKGROUNDS_PATH,
  MOUSE_CURSOR_KEYS,
  MOUSE_CURSOR_PATH,
  NUMBER_FORMAT_KEYS,
  NUMBER_FORMAT_PATH,
  RESOLUTIONS_PATH,
  RESOLUTION_KEYS,
  TOOLTIPS_PATH,
  TOOLTIP_KEYS,
  WIDGET_SECTIONS,
  WIDGET_SETTINGS_PATH,
  emptyFontEntry,
  emptyFontStyle,
  emptyWidgetSettings,
  parseBackgroundsFile,
  parseFontSettings,
  parseIconsFile,
  parseKeybindingsFile,
  parseKeyedValues,
  parseWidgetSettings,
  serializeBackgroundsFile,
  serializeFontSettings,
  serializeIconsFile,
  serializeKeybindingsFile,
  serializeWidgetSettings,
  upsertKeyedValues,
  type FontEntry,
  type IconSet,
  type KeybindRow,
  type WidgetSectionId,
} from '@/editor/uiEngine';
import { useRegisterDirty } from '@/context/SaveHealthContext';

type UiPane = 'general' | 'fonts' | 'colors' | 'tooltips' | 'resolutions' | 'combat' | 'numbers' | 'icons' | 'backgrounds' | 'cursor' | 'widgets' | 'defaults' | 'subtitles';

type FieldMeta = { key: string; label?: string; tip: string; width: FieldWidth; color?: boolean };

const COLOR_FIELDS: FieldMeta[] = [
  { key: 'menu_normal', tip: 'Basic menu text color. Recommended: white.', width: 'name', color: true },
  { key: 'menu_bonus', tip: 'Positive menu text color. Recommended: green.', width: 'name', color: true },
  { key: 'menu_penalty', tip: 'Negative menu text color. Recommended: red.', width: 'name', color: true },
  { key: 'widget_normal', tip: 'Basic widget text color. Recommended: white.', width: 'name', color: true },
  { key: 'widget_disabled', tip: 'Disabled widget text color. Recommended: grey.', width: 'name', color: true },
  { key: 'combat_givedmg', tip: 'Enemy damage text color. Recommended: white.', width: 'name', color: true },
  { key: 'combat_takedmg', tip: 'Player damage text color. Recommended: red.', width: 'name', color: true },
  { key: 'combat_crit', tip: 'Enemy critical damage text color. Recommended: yellow.', width: 'name', color: true },
  { key: 'combat_buff', tip: 'Healing or buff text color. Recommended: green.', width: 'name', color: true },
  { key: 'combat_miss', tip: 'Missed attack text color. Recommended: grey.', width: 'name', color: true },
  { key: 'requirements_not_met', tip: 'Unmet requirements text color. Recommended: red.', width: 'name', color: true },
  { key: 'item_bonus', tip: 'Item bonus text color. Recommended: green.', width: 'name', color: true },
  { key: 'item_penalty', tip: 'Item penalty text color. Recommended: red.', width: 'name', color: true },
  { key: 'item_flavor', tip: 'Item flavor text color. Recommended: grey.', width: 'name', color: true },
  { key: 'hardcore_color_name', tip: 'Permadeath save slot player name color. Recommended: red.', width: 'name', color: true },
];

const TOOLTIP_FIELDS: FieldMeta[] = [
  { key: 'tooltip_offset', tip: 'Offset in pixels from the cursor to the first (bottom) tooltip. Default 16.', width: 'num' },
  { key: 'tooltip_width', tip: 'Maximum width of tooltip text in pixels. The background grows to this width. Default 200; 0 is unlimited.', width: 'num' },
  { key: 'tooltip_margin', tip: 'Padding in pixels between the tooltip text and the tooltip borders. Default 6.', width: 'num' },
  { key: 'npc_tooltip_margin', tip: 'Distance in pixels from an NPC or enemy to the top of the tooltip when there is no mouse input. Default 64.', width: 'num' },
  { key: 'tooltip_background_border', tip: 'Pixel size of the border in images/menus/tooltips.png used when stretching the tooltip background. Default 4; 0 disables stretching.', width: 'num' },
  { key: 'tooltip_visible_max', tip: 'Maximum number of tooltips visible at once. Default 3; cannot be below 1.', width: 'num' },
];

const RESOLUTION_FIELDS: FieldMeta[] = [
  { key: 'menu_frame_width', tip: 'Width in pixels of the game menu background frames.', width: 'num' },
  { key: 'menu_frame_height', tip: 'Height in pixels of the game menu background frames.', width: 'num' },
  { key: 'icon_size', tip: 'Pixel size of each icon tile. Must not be 0; the engine defaults to 32 if it is.', width: 'num' },
  { key: 'required_width', tip: 'Smallest window width the game will prevent going below (unless prevent_<dim>_collapse is false). Default 640.', width: 'num' },
  { key: 'required_height', tip: 'Smallest window height the game will prevent going below (unless prevent_<dim>_collapse is false). Default 480.', width: 'num' },
  { key: 'virtual_height', tip: 'Comma-separated internal render heights. The engine picks the one closest to the window without going over, then scales up. Default 480.', width: 'name' },
  { key: 'virtual_dpi', tip: 'Virtual DPI used when DPI scaling is enabled. The default is 91.754738.', width: 'num' },
  { key: 'ignore_texture_filter', tip: 'If true, always use nearest-neighbor filtering for this mod, ignoring the user texture filter setting.', width: 'short' },
];

const COMBAT_TEXT_FIELDS: FieldMeta[] = [
  { key: 'duration', tip: 'How long combat text is visible, as milliseconds or a duration such as 1s.', width: 'short' },
  { key: 'speed', tip: 'Motion speed of floating combat text.', width: 'num' },
  { key: 'offset', tip: 'Vertical offset where the floating text starts.', width: 'num' },
  { key: 'fade_duration', tip: 'Fade-out duration, as milliseconds or a duration such as 400ms.', width: 'short' },
  { key: 'font', tip: 'Font id from font_settings.txt used for combat text.', width: 'id' },
];

const NUMBER_FORMAT_FIELDS: FieldMeta[] = [
  { key: 'player_statbar', label: 'Player health and mana', tip: 'How many decimals to show.', width: 'num' },
  { key: 'enemy_statbar', label: 'Enemy health', tip: 'How many decimals to show.', width: 'num' },
  { key: 'combat_text', label: 'Combat numbers', tip: 'How many decimals to show.', width: 'num' },
  { key: 'character_menu', label: 'Character menu', tip: 'How many decimals to show.', width: 'num' },
  { key: 'item_tooltips', label: 'Item tooltips', tip: 'How many decimals to show.', width: 'num' },
  { key: 'power_tooltips', label: 'Power tooltips', tip: 'How many decimals to show.', width: 'num' },
  { key: 'durations', label: 'Durations', tip: 'How many decimals to show.', width: 'num' },
  { key: 'death_penalty', label: 'Death penalty', tip: 'How many decimals to show.', width: 'num' },
];

const CURSOR_FIELDS: FieldMeta[] = [
  { key: 'normal', tip: 'Default cursor. Value is a filename, optionally followed by x and y offsets: image.png,0,0.', width: 'path' },
  { key: 'interact', tip: 'Cursor shown over interactable objects. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'talk', tip: 'Cursor shown over NPCs you can talk to. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'attack', tip: 'Cursor shown when attacking. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'lowhp_normal', tip: 'Low-HP variant of the normal cursor. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'lowhp_interact', tip: 'Low-HP variant of the interact cursor. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'lowhp_talk', tip: 'Low-HP variant of the talk cursor. Filename, optionally with x,y offsets.', width: 'path' },
  { key: 'lowhp_attack', tip: 'Low-HP variant of the attack cursor. Filename, optionally with x,y offsets.', width: 'path' },
];

const DEFAULT_SETTING_GROUPS: Array<{ label: string; fields: FieldMeta[] }> = [
  {
    label: 'Video',
    fields: [
      { key: 'fullscreen', tip: 'Fullscreen mode. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'resolution_w', tip: 'Window width in pixels.', width: 'num' },
      { key: 'resolution_h', tip: 'Window height in pixels.', width: 'num' },
      { key: 'hwsurface', tip: 'Hardware surfaces. Try disabling for performance. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'vsync', tip: 'V-sync. Try disabling for performance. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'texture_filter', tip: 'Texture filter quality. 0 = nearest neighbor, 1 = linear.', width: 'short' },
      { key: 'dpi_scaling', tip: 'DPI-based render scaling. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'parallax_layers', tip: 'Rendering of parallax map layers. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'max_fps', tip: 'Maximum frames per second. Default 60.', width: 'num' },
      { key: 'renderer', tip: 'Default render device. sdl_hardware is the default; try sdl for compatibility.', width: 'name' },
      { key: 'change_gamma', tip: 'Allow changing screen gamma (experimental). 0 = disable, 1 = enable.', width: 'short' },
      { key: 'gamma', tip: 'Screen gamma. Requires change_gamma=1. 0.5 = darkest, 2.0 = lightest.', width: 'num' },
      { key: 'hardware_cursor', tip: 'Use the system mouse cursor. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'min_render_size', tip: 'Overrides the minimum height of the internal render surface in pixels. 0 = ignore this setting.', width: 'num' },
      { key: 'max_render_size', tip: 'Overrides the maximum height of the internal render surface in pixels. 0 = ignore this setting.', width: 'num' },
      { key: 'fade_walls', tip: 'Lower the opacity of walls covering the player. 0 = disable, 1 = enable.', width: 'short' },
    ],
  },
  {
    label: 'Audio',
    fields: [
      { key: 'music_volume', tip: 'Music volume. 0 = silent, 128 = maximum.', width: 'num' },
      { key: 'sound_volume', tip: 'Sound volume. 0 = silent, 128 = maximum.', width: 'num' },
      { key: 'mute_on_focus_loss', tip: 'Mute game audio when the window loses focus. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'audio_freq', tip: 'Audio playback frequency in Hz. Default 44100.', width: 'num' },
    ],
  },
  {
    label: 'Input',
    fields: [
      { key: 'mouse_move', tip: 'Use the mouse to move. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'mouse_move_swap', tip: "Use Main2 as the movement action when mouse_move=1. 0 = disable, 1 = enable.", width: 'short' },
      { key: 'mouse_move_attack', tip: 'Allow attacking with the mouse movement button if an enemy is targeted and in range. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'mouse_aim', tip: 'Use the mouse to aim. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'no_mouse', tip: 'Make the mouse secondary and give full control to the keyboard. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'enable_joystick', tip: 'Enable joystick input. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'joystick_device', tip: 'Joystick device index.', width: 'num' },
      { key: 'joystick_deadzone', tip: 'Joystick deadzone.', width: 'num' },
      { key: 'joystick_rumble', tip: 'Joystick rumble or vibration. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'touch_controls', tip: 'Enable touch screen controls. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'touch_scale', tip: 'Scale factor for the touch controls. 1.0 = 100 percent.', width: 'num' },
    ],
  },
  {
    label: 'Interface',
    fields: [
      { key: 'language', tip: '2-letter language code.', width: 'short' },
      { key: 'combat_text', tip: 'Display floating damage text. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'show_fps', tip: 'Show frames per second. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'colorblind', tip: 'Enable colorblind help text. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'loot_tooltips', tip: 'Loot tooltip mode. 0 = normal, 1 = show all, 2 = hide all.', width: 'short' },
      { key: 'statbar_labels', tip: 'Always show labels on HP/MP/XP bars. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'statbar_autohide', tip: 'Allow the HP/MP/XP bars to auto-hide on inactivity. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'auto_equip', tip: 'Automatically equip items. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'auto_loot', tip: 'Automatically pick up loot. 0 = disable, 1 = enable, 2 = currency only.', width: 'short' },
      { key: 'subtitles', tip: 'Subtitles. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'minimap_mode', tip: 'Mini-map display mode. 0 = normal, 1 = 2x zoom, 2 = hidden.', width: 'short' },
      { key: 'item_compare_tips', tip: 'Show comparison tooltips for equipped items of the same type. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'low_hp_warning_type', tip: 'Low health warning. 0 = disable, 1 = all, 2 = message and cursor, 3 = message and sound, 4 = cursor and sound, 5 = message, 6 = cursor, 7 = sound.', width: 'short' },
      { key: 'low_hp_threshold', tip: 'Low HP warning threshold as a percentage.', width: 'num' },
      { key: 'pause_on_focus_loss', tip: 'Pause the game when the window loses focus. 0 = disable, 1 = enable.', width: 'short' },
    ],
  },
  {
    label: 'Developer and setup',
    fields: [
      { key: 'dev_mode', tip: 'Developer mode. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'dev_hud', tip: 'Show additional on-screen information when dev_mode=1. 0 = disable, 1 = enable.', width: 'short' },
      { key: 'dev_cmd_1', tip: 'Custom developer console shortcut command 1.', width: 'name' },
      { key: 'dev_cmd_2', tip: 'Custom developer console shortcut command 2.', width: 'name' },
      { key: 'dev_cmd_3', tip: 'Custom developer console shortcut command 3.', width: 'name' },
      { key: 'prev_save_slot', tip: 'Index of the last used save slot.', width: 'num' },
      { key: 'setup_language', tip: 'First-time-launch language dialog. 0 = show dialog, 1 = no dialog.', width: 'short' },
      { key: 'setup_mousemove', tip: 'First-time-launch mouse movement dialog. 0 = show dialog, 1 = no dialog.', width: 'short' },
    ],
  },
];

const WIDGET_FIELD_TIPS: Record<string, Partial<Record<string, string>>> = {
  misc: {
    selection_rect_color: 'Color and optional alpha of the selection rectangle when navigating widgets without a mouse.',
    selection_rect_corner_size: 'Size of the selection-rectangle corners. Set to 0 to draw the entire rectangle instead.',
    colorblind_highlight_offset: 'Pixel offset of the * marker on highlighted icons in colorblind mode, as x,y.',
  },
  tab: {
    padding: 'Pixel padding around tabs as left/right, top. Controls how the left and right edges are drawn.',
    text_padding: 'Left and right padding in pixels of the tab text label. Unlike padding, this does not change the tab background.',
  },
  slot: {
    quantity_label: 'Label settings for slot quantity text (position, alignment, font).',
    quantity_color: 'Text color for the slot quantity text.',
    quantity_bg_color: 'Fill color and optional alpha under quantity text.',
    hotkey_label: 'Label settings for slot hotkey text (position, alignment, font).',
    hotkey_color: 'Text color for the slot hotkey text.',
    hotkey_bg_color: 'Fill color and optional alpha under hotkey text.',
  },
  listbox: {
    text_margin: 'Pixel margin on the left and right of listbox element text, as left,right.',
  },
  horizontal_list: {
    text_width: 'Text width of a horizontal list widget.',
  },
  scrollbar: {
    bg_color: 'Scrollbar background color and optional alpha.',
  },
  log: {
    padding: 'Padding in pixels around log widgets.',
  },
  sound: {
    activate: 'Sound file played when a widget is activated.',
  },
};

const WIDGET_COLOR_KEYS = new Set([
  'selection_rect_color', 'quantity_color', 'quantity_bg_color', 'hotkey_color', 'hotkey_bg_color', 'bg_color',
]);

const PANES: Array<{ id: UiPane; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'colors', label: 'Colors' },
  { id: 'tooltips', label: 'Tooltips' },
  { id: 'resolutions', label: 'Resolutions' },
  { id: 'combat', label: 'Combat text' },
  { id: 'numbers', label: 'Number format' },
  { id: 'icons', label: 'Icons' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'subtitles', label: 'Subtitles' },
];

function withNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function KeyedFields({
  text, keys, fields, onChange,
}: {
  text: string;
  keys: readonly string[];
  fields: FieldMeta[];
  onChange: (text: string) => void;
}) {
  const values = parseKeyedValues(text, keys);
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-wrap items-center gap-2">
          <HintLabel className="text-xs font-normal w-52 shrink-0" hint={field.tip}>{field.label ?? field.key}</HintLabel>
          {field.color ? (
            <FlareColorField
              aria-label={field.label ?? field.key}
              value={values[field.key] ?? ''}
              onChange={(next) => onChange(upsertKeyedValues(text, keys, { [field.key]: next }))}
            />
          ) : (
            <Input
              aria-label={field.label ?? field.key}
              width={field.width}
              className="h-7 text-xs"
              value={values[field.key] ?? ''}
              onChange={(event) => onChange(upsertKeyedValues(text, keys, { [field.key]: event.target.value }))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Engine UI and platform-default files that belong on the UI Settings card. Tile size, Localization and Engine data stay on General. */
export default function UIEngineFilesPanel({ general }: { general: ReactNode }) {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [pane, setPane] = useState<UiPane>('general');
  const [fontsText, setFontsText] = useState('');
  const [colorsText, setColorsText] = useState('');
  const [tooltipsText, setTooltipsText] = useState('');
  const [resolutionsText, setResolutionsText] = useState('');
  const [combatText, setCombatText] = useState('');
  const [numberFormatText, setNumberFormatText] = useState('');
  const [iconsText, setIconsText] = useState('');
  const [backgroundsText, setBackgroundsText] = useState('');
  const [cursorText, setCursorText] = useState('');
  const [widgetsText, setWidgetsText] = useState('');
  const [defaultsText, setDefaultsText] = useState('');
  const [keybindsText, setKeybindsText] = useState('');
  const [subtitlesText, setSubtitlesText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const skipDiskLoadRef = useRef(false);

  const mark = (write: (value: string) => void) => (next: string) => { write(next); setDirty(true); };

  const loadAll = useCallback(async () => {
    const clear = () => {
      setFontsText(''); setColorsText(''); setTooltipsText(''); setResolutionsText('');
      setCombatText(''); setNumberFormatText(''); setIconsText(''); setBackgroundsText(''); setCursorText('');
      setWidgetsText(''); setDefaultsText(''); setKeybindsText(''); setSubtitlesText(''); setDirty(false);
    };
    if (!projectPath || !window.electronAPI?.readFile) {
      clear();
      return;
    }
    const fs = { readFile: window.electronAPI.readFile };
    const flarePath = getStoredFlarePath();
    const load = (relative: string) => loadEngineFileWithFallback({ projectPath, relative, flarePath, fs });
    const [
      fonts, colors, tooltips, resolutions, combat, numbers, icons, backgrounds, cursor, widgets, defaults, keybinds, subtitles,
    ] = await Promise.all([
      load(FONT_SETTINGS_PATH),
      load(FONT_COLORS_PATH),
      load(TOOLTIPS_PATH),
      load(RESOLUTIONS_PATH),
      load(COMBAT_TEXT_PATH),
      load(NUMBER_FORMAT_PATH),
      load(ICONS_PATH),
      load(MENU_BACKGROUNDS_PATH),
      load(MOUSE_CURSOR_PATH),
      load(WIDGET_SETTINGS_PATH),
      load(DEFAULT_SETTINGS_PATH),
      load(DEFAULT_KEYBINDINGS_PATH),
      load(SUBTITLES_PATH),
    ]);
    if (skipDiskLoadRef.current) return;
    setFontsText(fonts.text);
    setColorsText(colors.text);
    setTooltipsText(tooltips.text);
    setResolutionsText(resolutions.text);
    setCombatText(combat.text);
    setNumberFormatText(numbers.text);
    setIconsText(icons.text);
    setBackgroundsText(backgrounds.text);
    setCursorText(cursor.text);
    setWidgetsText(widgets.text);
    setDefaultsText(defaults.text);
    setKeybindsText(keybinds.text);
    setSubtitlesText(subtitles.text);
    setDirty(false);
  }, [projectPath]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving UI engine files.', variant: 'destructive' });
      return;
    }
    const files = [
      fontsText.trim() ? { path: FONT_SETTINGS_PATH, content: withNewline(fontsText) } : null,
      colorsText.trim() ? { path: FONT_COLORS_PATH, content: withNewline(colorsText) } : null,
      tooltipsText.trim() ? { path: TOOLTIPS_PATH, content: withNewline(tooltipsText) } : null,
      resolutionsText.trim() ? { path: RESOLUTIONS_PATH, content: withNewline(resolutionsText) } : null,
      combatText.trim() ? { path: COMBAT_TEXT_PATH, content: withNewline(combatText) } : null,
      numberFormatText.trim() ? { path: NUMBER_FORMAT_PATH, content: withNewline(numberFormatText) } : null,
      iconsText.trim() ? { path: ICONS_PATH, content: withNewline(iconsText) } : null,
      backgroundsText.trim() ? { path: MENU_BACKGROUNDS_PATH, content: withNewline(backgroundsText) } : null,
      cursorText.trim() ? { path: MOUSE_CURSOR_PATH, content: withNewline(cursorText) } : null,
      widgetsText.trim() ? { path: WIDGET_SETTINGS_PATH, content: withNewline(widgetsText) } : null,
      defaultsText.trim() ? { path: DEFAULT_SETTINGS_PATH, content: withNewline(defaultsText) } : null,
      keybindsText.trim() ? { path: DEFAULT_KEYBINDINGS_PATH, content: withNewline(keybindsText) } : null,
      subtitlesText.trim() ? { path: SUBTITLES_PATH, content: withNewline(subtitlesText) } : null,
    ].filter(Boolean) as Array<{ path: string; content: string }>;
    if (!files.length) {
      toast({ title: 'Nothing to write', description: 'No UI engine files were loaded.' });
      return;
    }
    setBusy(true);
    try {
      const saved = await writeProjectFiles(projectPath, files);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write the UI engine files.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: `Wrote ${files.map((file) => file.path).join(', ')}.` });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => ([
    fontsText.trim() ? { path: FONT_SETTINGS_PATH, content: withNewline(fontsText) } : null,
    colorsText.trim() ? { path: FONT_COLORS_PATH, content: withNewline(colorsText) } : null,
    tooltipsText.trim() ? { path: TOOLTIPS_PATH, content: withNewline(tooltipsText) } : null,
    resolutionsText.trim() ? { path: RESOLUTIONS_PATH, content: withNewline(resolutionsText) } : null,
    combatText.trim() ? { path: COMBAT_TEXT_PATH, content: withNewline(combatText) } : null,
    numberFormatText.trim() ? { path: NUMBER_FORMAT_PATH, content: withNewline(numberFormatText) } : null,
    iconsText.trim() ? { path: ICONS_PATH, content: withNewline(iconsText) } : null,
    backgroundsText.trim() ? { path: MENU_BACKGROUNDS_PATH, content: withNewline(backgroundsText) } : null,
    cursorText.trim() ? { path: MOUSE_CURSOR_PATH, content: withNewline(cursorText) } : null,
    widgetsText.trim() ? { path: WIDGET_SETTINGS_PATH, content: withNewline(widgetsText) } : null,
    defaultsText.trim() ? { path: DEFAULT_SETTINGS_PATH, content: withNewline(defaultsText) } : null,
    keybindsText.trim() ? { path: DEFAULT_KEYBINDINGS_PATH, content: withNewline(keybindsText) } : null,
    subtitlesText.trim() ? { path: SUBTITLES_PATH, content: withNewline(subtitlesText) } : null,
  ].filter(Boolean) as Array<{ path: string; content: string }>), [fontsText, colorsText, tooltipsText, resolutionsText, combatText, numberFormatText, iconsText, backgroundsText, cursorText, widgetsText, defaultsText, keybindsText, subtitlesText]);
  const applyUiDrafts = (incoming: Array<{ path: string; content: string }>) => {
    skipDiskLoadRef.current = true;
    const setters: Record<string, (value: string) => void> = {
      [FONT_SETTINGS_PATH]: setFontsText,
      [FONT_COLORS_PATH]: setColorsText,
      [TOOLTIPS_PATH]: setTooltipsText,
      [RESOLUTIONS_PATH]: setResolutionsText,
      [COMBAT_TEXT_PATH]: setCombatText,
      [NUMBER_FORMAT_PATH]: setNumberFormatText,
      [ICONS_PATH]: setIconsText,
      [MENU_BACKGROUNDS_PATH]: setBackgroundsText,
      [MOUSE_CURSOR_PATH]: setCursorText,
      [WIDGET_SETTINGS_PATH]: setWidgetsText,
      [DEFAULT_SETTINGS_PATH]: setDefaultsText,
      [DEFAULT_KEYBINDINGS_PATH]: setKeybindsText,
      [SUBTITLES_PATH]: setSubtitlesText,
    };
    let any = false;
    for (const file of incoming) {
      const set = setters[file.path.replace(/\\/g, '/')];
      if (!set) continue;
      set(file.content);
      any = true;
    }
    if (any) setDirty(true);
  };
  useRegisterDirty('ui-engine-files', dirty, save, dirty ? draftFiles : [], applyUiDrafts);

  const fonts = parseFontSettings(fontsText);
  const icons = parseIconsFile(iconsText);
  const backgrounds = parseBackgroundsFile(backgroundsText);
  const widgets = widgetsText.trim() ? parseWidgetSettings(widgetsText) : emptyWidgetSettings();
  const keybinds = parseKeybindingsFile(keybindsText);

  const setFonts = (next: FontEntry[]) => mark(setFontsText)(serializeFontSettings({ header: fonts.header, fonts: next }, fontsText));
  const setIcons = (next: { text_offset: string; sets: IconSet[] }) => mark(setIconsText)(serializeIconsFile({ header: icons.header, ...next }, iconsText));
  const setBackgrounds = (next: string[]) => mark(setBackgroundsText)(serializeBackgroundsFile({ header: backgrounds.header, backgrounds: next }, backgroundsText));
  const setWidgetValue = (section: string, key: string, value: string) => {
    const sections = {
      ...widgets.sections,
      [section]: { ...(widgets.sections[section] || {}), [key]: value },
    };
    mark(setWidgetsText)(serializeWidgetSettings({ header: widgets.header, sections }, widgetsText));
  };
  const setKeybinds = (next: { file_version?: string; binds?: KeybindRow[] }) => mark(setKeybindsText)(serializeKeybindingsFile({
    header: keybinds.header,
    file_version: next.file_version ?? keybinds.file_version,
    binds: next.binds ?? keybinds.binds,
    otherSections: keybinds.otherSections,
  }, keybindsText));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PANES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={pane === item.id ? 'default' : 'outline'}
              aria-pressed={pane === item.id}
              className={pane === item.id ? 'h-7 bg-orange-600 text-white hover:bg-orange-600 hover:text-white' : 'h-7'}
              onClick={() => setPane(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {pane !== 'general' ? (
          <Button type="button" size="sm" onClick={() => { void save(); }} disabled={!projectPath || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
        ) : null}
      </div>

      {pane === 'general' ? general
        : pane === 'fonts' ? (
          <div className="space-y-4">
            <FontLibrary projectPath={projectPath} />
            <FieldHint hint="engine/font_settings.txt. Each font has an id and one or more style lines: language, file, point size, blend, and optional bold, italic, underline, shadow_x, shadow_y. Language is default or a region code. Only .ttf files, usually under /fonts, are supported. font_fallback has been removed from Flare and is not written.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fonts</div>
            </FieldHint>
            {fonts.fonts.map((font, fontIndex) => (
              <div key={fontIndex} className="space-y-2 rounded-md border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Font id referenced by menus, combat text and other UI.">id</HintLabel>
                  <Input aria-label={`Font ${fontIndex + 1} id`} width="id" className="h-7 text-xs" value={font.id} onChange={(event) => {
                    const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, id: event.target.value } : item);
                    setFonts(next);
                  }} />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove font ${font.id || fontIndex + 1}`} onClick={() => setFonts(fonts.fonts.filter((_, index) => index !== fontIndex))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {font.styles.map((style, styleIndex) => (
                  <div key={styleIndex} className="flex flex-wrap items-center gap-1">
                    <Input aria-label={`Font ${font.id || fontIndex + 1} style ${styleIndex + 1} language`} width="short" className="h-7 text-xs" placeholder="lang" value={style.language} onChange={(event) => {
                      const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.map((row, rowIndex) => rowIndex === styleIndex ? { ...row, language: event.target.value } : row) } : item);
                      setFonts(next);
                    }} />
                    <Input aria-label={`Font ${font.id || fontIndex + 1} style ${styleIndex + 1} file`} width="path" className="h-7 text-xs" placeholder="file.ttf" list={FONT_FILE_LIST_ID} value={style.file} onChange={(event) => {
                      const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.map((row, rowIndex) => rowIndex === styleIndex ? { ...row, file: event.target.value } : row) } : item);
                      setFonts(next);
                    }} />
                    <Input aria-label={`Font ${font.id || fontIndex + 1} style ${styleIndex + 1} size`} width="num" className="h-7 text-xs" placeholder="pt" value={style.size} onChange={(event) => {
                      const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.map((row, rowIndex) => rowIndex === styleIndex ? { ...row, size: event.target.value } : row) } : item);
                      setFonts(next);
                    }} />
                    <Input aria-label={`Font ${font.id || fontIndex + 1} style ${styleIndex + 1} blend`} width="num" className="h-7 text-xs" placeholder="blend" value={style.blend} onChange={(event) => {
                      const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.map((row, rowIndex) => rowIndex === styleIndex ? { ...row, blend: event.target.value } : row) } : item);
                      setFonts(next);
                    }} />
                    <Input aria-label={`Font ${font.id || fontIndex + 1} style ${styleIndex + 1} extras`} width="name" className="h-7 text-xs" placeholder="bold,italic,…" value={style.extras} onChange={(event) => {
                      const next = fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.map((row, rowIndex) => rowIndex === styleIndex ? { ...row, extras: event.target.value } : row) } : item);
                      setFonts(next);
                    }} />
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove style ${styleIndex + 1}`} onClick={() => {
                      setFonts(fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: item.styles.filter((_, rowIndex) => rowIndex !== styleIndex) } : item));
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => {
                  setFonts(fonts.fonts.map((item, index) => index === fontIndex ? { ...item, styles: [...item.styles, emptyFontStyle()] } : item));
                }}>
                  <Plus className="w-3 h-3 mr-1" />Style
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setFonts([...fonts.fonts, emptyFontEntry()])}>
              <Plus className="w-3 h-3 mr-1" />Font
            </Button>
          </div>
        ) : pane === 'colors' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/font_colors.txt. Colors are r,g,b (0-255). Empty keys are not written; comments and unknown keys are kept.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Font colors</div>
            </FieldHint>
            <KeyedFields text={colorsText} keys={FONT_COLOR_KEYS} fields={COLOR_FIELDS} onChange={mark(setColorsText)} />
          </div>
        ) : pane === 'tooltips' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/tooltips.txt. tooltip_margin here is padding inside the tooltip box, not the loot tooltip_margin key. Empty keys are not written.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tooltips</div>
            </FieldHint>
            <KeyedFields text={tooltipsText} keys={TOOLTIP_KEYS} fields={TOOLTIP_FIELDS} onChange={mark(setTooltipsText)} />
          </div>
        ) : pane === 'resolutions' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/resolutions.txt. icon_size must not be 0. enable_playgame belongs in gameplay.txt, not here. Empty keys are not written.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resolutions</div>
            </FieldHint>
            <KeyedFields text={resolutionsText} keys={RESOLUTION_KEYS} fields={RESOLUTION_FIELDS} onChange={mark(setResolutionsText)} />
          </div>
        ) : pane === 'combat' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/combat_text.txt. Duration fields accept milliseconds or values such as 1s and 400ms.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Combat text</div>
            </FieldHint>
            <KeyedFields text={combatText} keys={COMBAT_TEXT_KEYS} fields={COMBAT_TEXT_FIELDS} onChange={mark(setCombatText)} />
          </div>
        ) : pane === 'numbers' ? (
          <div className="space-y-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Number format</div>
              <p className="text-[11px] text-muted-foreground">Choose how many decimal places each number shows.</p>
            </div>
            <KeyedFields text={numberFormatText} keys={NUMBER_FORMAT_KEYS} fields={NUMBER_FORMAT_FIELDS} onChange={mark(setNumberFormatText)} />
          </div>
        ) : pane === 'icons' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/icons.txt. icon_set is first icon id and image file. text_offset is the x,y pixel offset for item quantity text. If no icon_set is defined, Flare loads images/icons/icons.png at id 0.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Icons</div>
            </FieldHint>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="Pixel offset from the top-left to place item quantity text on icons, as x,y.">text_offset</HintLabel>
              <Input aria-label="text_offset" width="short" className="h-7 text-xs" value={icons.text_offset} onChange={(event) => setIcons({ text_offset: event.target.value, sets: icons.sets })} />
            </div>
            {icons.sets.map((set, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1">
                <Input aria-label={`icon_set ${index + 1} first id`} width="num" className="h-7 text-xs" placeholder="id" value={set.firstId} onChange={(event) => {
                  setIcons({ text_offset: icons.text_offset, sets: icons.sets.map((row, rowIndex) => rowIndex === index ? { ...row, firstId: event.target.value } : row) });
                }} />
                <Input aria-label={`icon_set ${index + 1} file`} width="path" className="h-7 text-xs" placeholder="images/icons/icons.png" value={set.file} onChange={(event) => {
                  setIcons({ text_offset: icons.text_offset, sets: icons.sets.map((row, rowIndex) => rowIndex === index ? { ...row, file: event.target.value } : row) });
                }} />
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove icon set ${index + 1}`} onClick={() => setIcons({ text_offset: icons.text_offset, sets: icons.sets.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setIcons({ text_offset: icons.text_offset, sets: [...icons.sets, { firstId: '', file: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Icon set
            </Button>
          </div>
        ) : pane === 'backgrounds' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/menu_backgrounds.txt. Each background is an image file shown behind the title and configuration menus. Music belongs in default_music.txt, not here.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Menu backgrounds</div>
            </FieldHint>
            {backgrounds.backgrounds.map((background, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1">
                <Input aria-label={`background ${index + 1}`} width="path" className="h-7 text-xs" value={background} onChange={(event) => {
                  setBackgrounds(backgrounds.backgrounds.map((row, rowIndex) => rowIndex === index ? event.target.value : row));
                }} />
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove background ${index + 1}`} onClick={() => setBackgrounds(backgrounds.backgrounds.filter((_, rowIndex) => rowIndex !== index))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setBackgrounds([...backgrounds.backgrounds, ''])}>
              <Plus className="w-3 h-3 mr-1" />Background
            </Button>
          </div>
        ) : pane === 'cursor' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/mouse_cursor.txt. Each action is a filename, optionally followed by x and y offsets.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mouse cursor</div>
            </FieldHint>
            <KeyedFields text={cursorText} keys={MOUSE_CURSOR_KEYS} fields={CURSOR_FIELDS} onChange={mark(setCursorText)} />
          </div>
        ) : pane === 'widgets' ? (
          <div className="space-y-3">
            <FieldHint hint="engine/widget_settings.txt. Sections are [misc], [tab], [slot], [listbox], [horizontal_list], [scrollbar], [log] and [sound]. APPEND and unknown keys are kept. Empty keys are not written. Colors may include an alpha component.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Widgets</div>
            </FieldHint>
            {(Object.keys(WIDGET_SECTIONS) as WidgetSectionId[]).map((section) => (
              <div key={section} className="space-y-2">
                <div className="text-xs font-medium">{section}</div>
                {WIDGET_SECTIONS[section].map((key) => {
                  const value = widgets.sections[section]?.[key] ?? '';
                  const tip = WIDGET_FIELD_TIPS[section]?.[key] || key;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2">
                      <HintLabel className="text-xs font-normal w-52 shrink-0" hint={tip}>{key}</HintLabel>
                      {WIDGET_COLOR_KEYS.has(key) ? (
                        <FlareColorField aria-label={`${section}.${key}`} value={value} onChange={(next) => setWidgetValue(section, key, next)} />
                      ) : (
                        <Input aria-label={`${section}.${key}`} width={key.includes('label') || key === 'activate' ? 'path' : 'short'} className="h-7 text-xs" value={value} onChange={(event) => setWidgetValue(section, key, event.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : pane === 'defaults' ? (
          <div className="space-y-3">
            <FieldHint hint="engine/default_settings.txt. These are the values Flare uses when the player has no settings.txt yet. Many mods do not ship this file; it is common in platform packs such as gcw0_defaults. Empty keys are not written; unknown keys such as older show_target are kept.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default settings</div>
            </FieldHint>
            {DEFAULT_SETTING_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="text-xs font-medium">{group.label}</div>
                <KeyedFields text={defaultsText} keys={DEFAULT_SETTINGS_KEYS} fields={group.fields} onChange={mark(setDefaultsText)} />
              </div>
            ))}
            <FieldHint hint="engine/default_keybindings.txt. Current Flare format is file_version (minimum 1.12.90) and a [default] section of action=bind,type lines. Type is 0=Keyboard, 1=Mouse, 2=Gamepad button, 3=Gamepad axis. Prefix the bind with SDL: for a key name (SDL:space). For a negative gamepad axis, end the bind with :- (SDL:leftx:-). A bind of -1 clears every binding for that action. Repeat an action to add another bind. Saving a pre-1.12.90 unsectioned file writes this current format so the engine will load it. A [user] section is kept as-is.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default keybindings</div>
            </FieldHint>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="File format version. Must be at least 1.12.90 or Flare will reset the bindings.">file_version</HintLabel>
              <Input aria-label="file_version" width="name" className="h-7 text-xs" value={keybinds.file_version} onChange={(event) => setKeybinds({ file_version: event.target.value })} />
            </div>
            {keybinds.binds.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1">
                <Input aria-label={`keybind ${index + 1} action`} width="id" className="h-7 text-xs" placeholder="action" value={row.action} onChange={(event) => {
                  setKeybinds({ binds: keybinds.binds.map((item, rowIndex) => rowIndex === index ? { ...item, action: event.target.value } : item) });
                }} />
                <Input aria-label={`keybind ${index + 1} value`} width="name" className="h-7 text-xs" placeholder="bind,type" value={row.value} onChange={(event) => {
                  setKeybinds({ binds: keybinds.binds.map((item, rowIndex) => rowIndex === index ? { ...item, value: event.target.value } : item) });
                }} />
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove keybind ${index + 1}`} onClick={() => setKeybinds({ binds: keybinds.binds.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setKeybinds({ binds: [...keybinds.binds, { action: '', value: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Bind
            </Button>
          </div>
        ) : (
          <SubtitlesForm text={subtitlesText} projectPath={projectPath} onChange={mark(setSubtitlesText)} />
        )}
    </div>
  );
}
