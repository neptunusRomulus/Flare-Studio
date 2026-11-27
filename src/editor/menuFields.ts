/**
 * User-facing fields for the per-menu keys that Flare reads outside the common
 * Menu::parseMenuKey set. The engine key stays in this catalog (and in the
 * file), never in a label or tooltip.
 */

export type MenuFieldKind =
  | 'switch'
  | 'number'
  | 'text'
  | 'path'
  | 'path-rest'
  | 'point'
  | 'rect'
  | 'color'
  | 'select'
  | 'duration'
  | 'label'
  | 'string-point'
  | 'string-rect'
  | 'string-label'
  | 'point-path';

export type MenuFieldOption = { value: string; label: string };

export type MenuField = {
  key: string;
  label: string;
  kind: MenuFieldKind;
  hint?: string;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: MenuFieldOption[];
  /** Engine default when the key is absent from the file. */
  defaultValue?: boolean;
};

export const MENU_FIELDS: Record<string, MenuField[]> = {
  'activeeffects.txt': [
    { key: 'vertical', label: 'Stack vertically', kind: 'switch', defaultValue: false, hint: 'Show active effects in a vertical column.' },
    { key: 'wrap_before', label: 'Wrap before the edge', kind: 'switch', defaultValue: false, hint: 'Wrap the icons before they reach the screen edge.' },
  ],
  'confirm.txt': [
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'action_list', label: 'Action list position', kind: 'point' },
    { key: 'label_title', label: 'Title text', kind: 'label' },
  ],
  'devconsole.txt': [
    { key: 'font', label: 'Console font', kind: 'text', placeholder: 'font_regular' },
    { key: 'font_bold', label: 'Bold font', kind: 'text', placeholder: 'font_bold' },
    { key: 'color_background', label: 'Background color', kind: 'color' },
    { key: 'color_resize_handle', label: 'Resize handle color', kind: 'color' },
  ],
  'enemy.txt': [
    { key: 'bar_pos', label: 'Health bar area', kind: 'rect' },
    { key: 'bar_fill_offset', label: 'Fill offset', kind: 'point' },
    { key: 'bar_fill_size', label: 'Fill size', kind: 'point' },
    { key: 'bar_gfx', label: 'Fill image', kind: 'path', placeholder: 'Fill image' },
    { key: 'timeout', label: 'Hide after', kind: 'duration', hint: 'How long the enemy panel stays after the enemy is gone.' },
    { key: 'text_pos', label: 'Name and level text', kind: 'label' },
  ],
  'fps.txt': [
    { key: 'position', label: 'Counter position', kind: 'point' },
    { key: 'color', label: 'Counter color', kind: 'color' },
  ],
  'game_over.txt': [
    { key: 'button_continue', label: 'Continue button', kind: 'point' },
    { key: 'button_exit', label: 'Exit button', kind: 'point' },
    { key: 'label_title', label: 'Title text', kind: 'label' },
  ],
  'hudlog.txt': [
    { key: 'enable_overlay', label: 'Show message overlay', kind: 'switch', defaultValue: true },
    { key: 'start_at_bottom', label: 'Start messages at the bottom', kind: 'switch', defaultValue: true },
    { key: 'overlay_at_bottom', label: 'Show overlay at the bottom', kind: 'switch', defaultValue: true },
  ],
  'log.txt': [
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'tab_area', label: 'Tab area', kind: 'rect' },
    { key: 'label_title', label: 'Log title', kind: 'label' },
  ],
  'num_picker.txt': [
    { key: 'confirm', label: 'OK button', kind: 'point' },
    { key: 'increase', label: 'Increase button', kind: 'point' },
    { key: 'decrease', label: 'Decrease button', kind: 'point' },
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'input', label: 'Value field', kind: 'point' },
    { key: 'label_title', label: 'Amount title', kind: 'label' },
  ],
  'powers.txt': [
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'tab_area', label: 'Tab area', kind: 'rect' },
    { key: 'upgrade_button_offset', label: 'Upgrade button offset', kind: 'point' },
    { key: 'tooltip_text_shield', label: 'Shield tooltip text', kind: 'text' },
    { key: 'tooltip_text_heal', label: 'Heal tooltip text', kind: 'text' },
    { key: 'label_title', label: 'Powers title', kind: 'label' },
    { key: 'unspent_points', label: 'Unspent points text', kind: 'label' },
  ],
  'region_title.txt': [
    { key: 'hold_duration', label: 'Hold time', kind: 'duration' },
    { key: 'fade_in_duration', label: 'Fade in', kind: 'duration' },
    { key: 'fade_out_duration', label: 'Fade out', kind: 'duration' },
    { key: 'label_title', label: 'Map name text', kind: 'label' },
  ],
  'character.txt': [
    { key: 'show_resists', label: 'Show resistances', kind: 'switch', defaultValue: true, hint: 'Show resistance stats in the stat list.' },
    { key: 'name', label: 'Name hotspot', kind: 'rect', hint: 'Where the hero name is shown, and the area that shows its tooltip.' },
    { key: 'level', label: 'Level hotspot', kind: 'rect', hint: 'Where the hero level is shown, and the area that shows its tooltip.' },
    { key: 'name_max_width', label: 'Name width', kind: 'number', suffix: 'px', min: 0, hint: 'Long names are shortened after this width.' },
    { key: 'statlist', label: 'Stat list position', kind: 'point' },
    { key: 'statlist_rows', label: 'Stat list rows', kind: 'number', min: 1 },
    { key: 'statlist_scrollbar_offset', label: 'Scrollbar margin', kind: 'number', suffix: 'px', min: 0 },
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'label_title', label: 'Character title', kind: 'label' },
    { key: 'label_name', label: 'Name text', kind: 'label' },
    { key: 'label_level', label: 'Level text', kind: 'label' },
    { key: 'unspent', label: 'Unspent points text', kind: 'label' },
    { key: 'primary', label: 'Primary stat area', kind: 'string-rect', placeholder: 'e.g. strength' },
    { key: 'upgrade_primary', label: 'Add point button', kind: 'string-point', placeholder: 'e.g. strength' },
    { key: 'label_primary', label: 'Primary stat text', kind: 'string-label', placeholder: 'e.g. strength' },
  ],
  'inventory.txt': [
    { key: 'carried_area', label: 'First item slot', kind: 'point' },
    { key: 'carried_cols', label: 'Item columns', kind: 'number', min: 1 },
    { key: 'carried_rows', label: 'Item rows', kind: 'number', min: 1 },
    { key: 'preview_enabled', label: 'Show character preview', kind: 'switch', defaultValue: false },
    { key: 'preview_pos', label: 'Preview position', kind: 'point' },
    { key: 'sort_enabled', label: 'Show sort button', kind: 'switch', defaultValue: false },
    { key: 'sort_pos', label: 'Sort button', kind: 'point' },
    { key: 'help', label: 'Help area', kind: 'rect' },
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'label_title', label: 'Inventory title', kind: 'label' },
    { key: 'label_equipment_set', label: 'Equipment set text', kind: 'label' },
    { key: 'currency', label: 'Currency text', kind: 'label' },
    { key: 'set_previous', label: 'Previous set button', kind: 'point-path', placeholder: 'Button image' },
    { key: 'set_next', label: 'Next set button', kind: 'point-path', placeholder: 'Button image' },
  ],
  'vendor.txt': [
    { key: 'slots_area', label: 'First shop slot', kind: 'point' },
    { key: 'vendor_cols', label: 'Shop columns', kind: 'number', min: 1 },
    { key: 'vendor_rows', label: 'Shop rows', kind: 'number', min: 1 },
    {
      key: 'sort_stock_buy', label: 'Sort buy stock by', kind: 'select',
      options: [
        { value: '', label: 'Game default' },
        { value: 'none', label: 'No sorting' },
        { value: 'type', label: 'Type' },
        { value: 'quality', label: 'Quality' },
        { value: 'level', label: 'Level' },
        { value: 'price', label: 'Price' },
        { value: 'id', label: 'ID' },
      ],
    },
    {
      key: 'sort_stock_craft', label: 'Sort craft stock by', kind: 'select',
      options: [
        { value: '', label: 'Game default' },
        { value: 'none', label: 'No sorting' },
        { value: 'type', label: 'Type' },
        { value: 'quality', label: 'Quality' },
        { value: 'level', label: 'Level' },
        { value: 'price', label: 'Price' },
        { value: 'id', label: 'ID' },
      ],
    },
    { key: 'soundfx_craft', label: 'Crafting sound', kind: 'path', placeholder: 'Default' },
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'label_title', label: 'Vendor title', kind: 'label' },
  ],
  'stash.txt': [
    { key: 'slots_area', label: 'First stash slot', kind: 'point' },
    { key: 'stash_cols', label: 'Stash columns', kind: 'number', min: 1 },
    { key: 'stash_rows', label: 'Stash rows', kind: 'number', min: 1 },
    { key: 'sort_enabled', label: 'Show sort button', kind: 'switch', defaultValue: false },
    { key: 'sort_pos', label: 'Sort button', kind: 'point' },
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'label_title', label: 'Stash title', kind: 'label' },
    { key: 'currency', label: 'Currency text', kind: 'label' },
  ],
  'talker.txt': [
    { key: 'close', label: 'Close button', kind: 'point' },
    { key: 'advance', label: 'Continue button', kind: 'point' },
    { key: 'dialogbox', label: 'Dialog box', kind: 'rect' },
    { key: 'dialogtext', label: 'Dialog text area', kind: 'rect' },
    { key: 'text_offset', label: 'Text margin', kind: 'point' },
    { key: 'portrait_he', label: 'NPC portrait', kind: 'rect' },
    { key: 'portrait_you', label: 'Player portrait', kind: 'rect' },
    { key: 'font_who', label: 'Speaker font', kind: 'text' },
    { key: 'font_dialog', label: 'Dialog font', kind: 'text' },
    { key: 'topic_color_normal', label: 'Topic text', kind: 'color' },
    { key: 'topic_color_hover', label: 'Topic text, hover', kind: 'color' },
    { key: 'topic_color_pressed', label: 'Topic text, pressed', kind: 'color' },
    { key: 'trade_color_normal', label: 'Trade text', kind: 'color' },
    { key: 'trade_color_hover', label: 'Trade text, hover', kind: 'color' },
    { key: 'trade_color_pressed', label: 'Trade text, pressed', kind: 'color' },
  ],
  'minimap.txt': [
    { key: 'map_pos', label: 'Map area', kind: 'rect' },
    { key: 'button_config', label: 'Settings button', kind: 'point' },
    { key: 'default_zoom_level', label: 'Default zoom', kind: 'number', min: 1 },
    { key: 'color_wall', label: 'Walls', kind: 'color' },
    { key: 'color_obst', label: 'Obstacles', kind: 'color' },
    { key: 'color_hero', label: 'Hero', kind: 'color' },
    { key: 'color_enemy', label: 'Enemies', kind: 'color' },
    { key: 'color_ally', label: 'Allies', kind: 'color' },
    { key: 'color_npc', label: 'NPCs', kind: 'color' },
    { key: 'color_teleport', label: 'Teleports', kind: 'color' },
    { key: 'text_pos', label: 'Map name text', kind: 'label' },
  ],
  'gametitle.txt': [
    { key: 'logo', label: 'Logo image', kind: 'path-rest', placeholder: 'images/menus/logo.png' },
    { key: 'play_pos', label: 'Play button', kind: 'point' },
    { key: 'config_pos', label: 'Settings button', kind: 'point' },
    { key: 'credits_pos', label: 'Credits button', kind: 'point' },
    { key: 'exit_pos', label: 'Exit button', kind: 'point' },
  ],
  'gameload.txt': [
    { key: 'visible_slots', label: 'Save slots shown', kind: 'number', min: 1 },
    { key: 'text_trim_boundary', label: 'Text trim width', kind: 'number', suffix: 'px', min: 0 },
    { key: 'show_frame_background', label: 'Show frame background', kind: 'switch', defaultValue: false },
    { key: 'button_new', label: 'New game button', kind: 'point' },
    { key: 'button_load', label: 'Load button', kind: 'point' },
    { key: 'button_delete', label: 'Delete button', kind: 'point' },
    { key: 'button_exit', label: 'Exit button', kind: 'point' },
    { key: 'portrait', label: 'Portrait area', kind: 'rect' },
    { key: 'gameslot', label: 'Save slot area', kind: 'rect' },
    { key: 'name', label: 'Name position', kind: 'point' },
    { key: 'level', label: 'Level position', kind: 'point' },
    { key: 'class', label: 'Class position', kind: 'point' },
    { key: 'map', label: 'Map position', kind: 'point' },
    { key: 'loading_label', label: 'Loading text', kind: 'point' },
    { key: 'sprite', label: 'Character preview', kind: 'point' },
    { key: 'slot_number', label: 'Slot number text', kind: 'label' },
  ],
  'gamenew.txt': [
    { key: 'show_classlist', label: 'Show class list', kind: 'switch', defaultValue: true },
    { key: 'show_class_tip', label: 'Show class description', kind: 'switch', defaultValue: false },
    { key: 'show_randomize', label: 'Show randomize button', kind: 'switch', defaultValue: true },
    { key: 'show_permadeath', label: 'Show permadeath option', kind: 'switch', defaultValue: true },
    { key: 'show_frame_background', label: 'Show frame background', kind: 'switch', defaultValue: false },
    { key: 'class_list', label: 'Class list position', kind: 'point' },
    { key: 'class_tip', label: 'Class description position', kind: 'point' },
    { key: 'random_option', label: 'Start with a random look', kind: 'switch', defaultValue: false },
    { key: 'random_class', label: 'Start with a random class', kind: 'switch', defaultValue: false },
    { key: 'classlist_height', label: 'Class list height', kind: 'number', min: 1 },
    { key: 'button_prev', label: 'Previous button', kind: 'point' },
    { key: 'button_next', label: 'Next button', kind: 'point' },
    { key: 'button_exit', label: 'Exit button', kind: 'point' },
    { key: 'button_create', label: 'Create button', kind: 'point' },
    { key: 'button_permadeath', label: 'Permadeath button', kind: 'point' },
    { key: 'button_randomize', label: 'Randomize button', kind: 'point' },
    { key: 'name_input', label: 'Name field', kind: 'point' },
    { key: 'portrait_label', label: 'Portrait label', kind: 'point' },
    { key: 'name_label', label: 'Name label', kind: 'point' },
    { key: 'permadeath_label', label: 'Permadeath label', kind: 'point' },
    { key: 'classlist_label', label: 'Class list label', kind: 'point' },
    { key: 'portrait', label: 'Portrait area', kind: 'rect' },
  ],
  'config.txt': [
    { key: 'show_frame_background', label: 'Show frame background', kind: 'switch', defaultValue: false },
    { key: 'button_ok', label: 'OK button', kind: 'point' },
    { key: 'button_defaults', label: 'Defaults button', kind: 'point' },
    { key: 'button_cancel', label: 'Cancel button', kind: 'point' },
    { key: 'listbox_scrollbar_offset', label: 'List scrollbar margin', kind: 'number', suffix: 'px', min: 0 },
    { key: 'frame_offset', label: 'Frame offset', kind: 'point' },
    { key: 'tab_offset', label: 'Tab offset', kind: 'point' },
    { key: 'background_offset', label: 'Background offset', kind: 'point' },
    { key: 'scrollpane', label: 'Settings area', kind: 'rect' },
    { key: 'scrollpane_padding', label: 'Settings padding', kind: 'point' },
    { key: 'scrollpane_separator_color', label: 'Separator color', kind: 'color' },
    { key: 'scrollpane_bg_color', label: 'Settings background', kind: 'color' },
    { key: 'activemods', label: 'Active mods area', kind: 'rect' },
    { key: 'activemods_height', label: 'Active mods rows', kind: 'number', min: 1 },
    { key: 'inactivemods', label: 'Available mods area', kind: 'rect' },
    { key: 'inactivemods_height', label: 'Available mods rows', kind: 'number', min: 1 },
    { key: 'activemods_shiftup', label: 'Move mod up button', kind: 'point' },
    { key: 'activemods_shiftdown', label: 'Move mod down button', kind: 'point' },
    { key: 'activemods_deactivate', label: 'Disable mod button', kind: 'point' },
    { key: 'inactivemods_activate', label: 'Enable mod button', kind: 'point' },
    { key: 'inactivemods_filter', label: 'Mod filter position', kind: 'point' },
  ],
};
