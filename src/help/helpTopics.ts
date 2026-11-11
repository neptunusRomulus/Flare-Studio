/**
 * Help screen content: short topic cards + the real keyboard shortcuts.
 * Keep every card to 1–2 plain sentences. Shortcuts must match the actual bindings
 * (TileMapEditor.handleKeyDown, targetGroups Tab handling, interfaceScale, EditorCanvas).
 */

/** Where a card's "Go there" button leads. Layer types are real editor layer types. */
export type HelpTarget = 'background' | 'npc' | 'enemy' | 'event' | 'items' | 'status' | 'rules' | 'quest-map' | 'display';

export type HelpTopic = {
  id: string;
  title: string;
  text: string;
  /** Extra search words (synonyms, raw Flare words). */
  keywords: string;
  /** Where "Go there" leads; omitted = no button. */
  target?: HelpTarget;
  /** Short place hint shown on the button tooltip. */
  where?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'map',
    title: 'Map painting & layers',
    text: 'Paint Ground, Object and Collision tiles with the brush, fill and eyedropper. Tab switches between them; scroll on a tab button to fade it.',
    keywords: 'tiles tileset brush bucket fill eraser eyedropper collision wall pit opacity visibility layer stamp',
    target: 'background',
    where: 'Map › Ground',
  },
  {
    id: 'npcs',
    title: 'NPCs & roles',
    text: 'Add an NPC, then switch on Talker, Vendor or Quest. The gear next to the roles opens the Role center.',
    keywords: 'npc character talker vendor shop quest giver role center portrait sprite',
    target: 'npc',
    where: 'Entities › NPC',
  },
  {
    id: 'dialogue',
    title: 'Dialogue chat',
    text: 'NPC lines and player replies show as chat bubbles. Conditions and rewards sit on each line.',
    keywords: 'dialogue dialog talk conversation chat bubble topic reply text',
    target: 'npc',
    where: 'Entities › NPC › Role center',
  },
  {
    id: 'quests',
    title: 'Quests & steps',
    text: 'A quest is a stack of step cards. Add a step, drag to reorder, and pick when its journal text shows.',
    keywords: 'quest journal step stage log objective',
    target: 'rules',
    where: 'Content › Quests',
  },
  {
    id: 'quest-map',
    title: 'Quest Map',
    text: 'The network button next to "+ Quest" toggles a board of every quest, the NPCs and map events that start or finish them, and the Story Flags that link them.',
    keywords: 'quest map board graph tree flow canvas overview toggle network button event npc story flag',
    target: 'quest-map',
    where: 'Content › Quests',
  },
  {
    id: 'moments',
    title: 'Moments & Play',
    text: 'Moments group what an NPC says by quest stage. Press Play to try the talk without changing any file.',
    keywords: 'moments stage play test simulate preview role center shop open',
    target: 'npc',
    where: 'Entities › NPC › Role center',
  },
  {
    id: 'enemies',
    title: 'Enemies',
    text: 'Create an enemy, then click the map to place it. Stats and loot live in the enemy editor.',
    keywords: 'enemy monster creature spawn stats loot drop',
    target: 'enemy',
    where: 'Entities › Enemy',
  },
  {
    id: 'items',
    title: 'Items & loot',
    text: 'Make weapons, armor and potions. Loot groups are lists that enemies and chests drop from.',
    keywords: 'item weapon armor potion gear loot group drop chest reward',
    target: 'items',
    where: 'Content › Items',
  },
  {
    id: 'events',
    title: 'Events',
    text: 'Events are map spots that react: doors, chests, teleports and triggers. Place one, then set what it does.',
    keywords: 'event trigger door chest teleport intermap spawn cutscene hotspot',
    target: 'event',
    where: 'Entities › Event',
  },
  {
    id: 'statuses',
    title: 'Statuses & Story Flags',
    text: 'This list groups Skills, Monster Attacks, Item Uses, Traps, Buffs and Debuffs. Story Flags are on/off marks, like "met the guard", that quests and dialogue check.',
    keywords: 'status power effect buff debuff skill monster attack item use trap story flag campaign requires_status set_status',
    target: 'status',
    where: 'Content › Statuses',
  },
  {
    id: 'display',
    title: 'Interface & text size',
    text: 'Engine Settings › Display sets interface and text size. Ctrl + and Ctrl − change it anywhere, Ctrl 0 resets.',
    keywords: 'display zoom scale font text size interface ui bigger smaller engine settings',
    target: 'display',
    where: 'Engine Settings › Display',
  },
  {
    id: 'export',
    title: 'Export & Play in Flare',
    text: 'Play in the title bar saves and opens your game in Flare. Export Project is in the app menu behind the Flare Studio mark.',
    keywords: 'export play run launch test flare engine mod package build new game icon logo brand mark menu',
  },
];

export type HelpShortcut = { keys: string[]; label: string };

export const HELP_SHORTCUTS: HelpShortcut[] = [
  { keys: ['Ctrl', 'S'], label: 'Save' },
  { keys: ['Ctrl', 'Z'], label: 'Undo' },
  { keys: ['Ctrl', 'Y'], label: 'Redo (also Ctrl Shift Z)' },
  { keys: ['Ctrl', 'C / V'], label: 'Copy / paste selection' },
  { keys: ['Ctrl', 'A'], label: 'Select all' },
  { keys: ['Hold Ctrl'], label: 'Select tiles' },
  { keys: ['Enter'], label: 'Fill selection' },
  { keys: ['Delete'], label: 'Clear selection' },
  { keys: ['Esc'], label: 'Cancel' },
  { keys: ['Space', 'Drag'], label: 'Pan (or middle drag)' },
  { keys: ['Wheel'], label: 'Zoom' },
  { keys: ['Tab'], label: 'Next sub-tab' },
  { keys: ['Shift', 'Tab'], label: 'Next main tab' },
  { keys: ['Ctrl', '+ / − / 0'], label: 'Interface size' },
];

export const HELP_LINKS = [
  { label: 'Flare wiki', url: 'https://github.com/flareteam/flare-engine/wiki' },
  { label: 'flarerpg.org', url: 'https://flarerpg.org' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** Every search word must appear somewhere in the topic (title, text or keywords). */
export function filterHelpTopics(query: string, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return topics;
  return topics.filter((t) => {
    const hay = norm(`${t.title} ${t.text} ${t.keywords} ${t.where ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

export function filterHelpShortcuts(query: string, shortcuts: HelpShortcut[] = HELP_SHORTCUTS): HelpShortcut[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return shortcuts;
  return shortcuts.filter((s) => {
    const hay = norm(`${s.keys.join(' ')} ${s.label} shortcut key keyboard`);
    return words.every((w) => hay.includes(w));
  });
}
