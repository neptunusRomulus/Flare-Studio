/**
 * Ready-made dialogue topics ("recipes"). Each one writes the engine parts a role needs,
 * then stays a normal topic the designer can edit line by line.
 */
import type { DialogueTree } from '@/types';

export type DialogueRecipe = {
  id: string;
  label: string;
  /** One line for the picker tooltip (raw Flare keys stay in the effect tooltips). */
  description: string;
  build: (key: string, dialogueId: string) => DialogueTree;
};

const base = (key: string, dialogueId: string, topic: string): DialogueTree => ({
  id: key,
  dialogueId,
  topic,
  responseOnly: false,
  responses: [],
  requirements: [],
  dialogues: [],
  rewards: [],
  worldEffects: [],
});

const say = (text: string) => ({ id: `${Date.now()}`, speaker: 'npc' as const, text });

export const DIALOGUE_RECIPES: DialogueRecipe[] = [
  {
    id: 'banker',
    label: 'Banker',
    description: 'Opens the player stash when the topic ends.',
    build: (key, dialogueId) => ({
      ...base(key, dialogueId, 'Bank'),
      dialogues: [say('Your belongings are safe with me.')],
      worldEffects: [{ id: `${key}_fx`, type: 'stash', value: 'true' }],
    }),
  },
  {
    id: 'book',
    label: 'Book / lore',
    description: 'Opens a book file when the topic ends.',
    build: (key, dialogueId) => ({
      ...base(key, dialogueId, 'Lore'),
      dialogues: [say('Take a look at this.')],
      worldEffects: [{ id: `${key}_fx`, type: 'book', value: 'books/lore.txt' }],
    }),
  },
  {
    id: 'trainer',
    label: 'Trainer',
    description: 'Lets the player respec stats.',
    build: (key, dialogueId) => ({
      ...base(key, dialogueId, 'Training'),
      dialogues: [say('Ready to reshape your path?')],
      worldEffects: [{ id: `${key}_fx`, type: 'respec', value: 'stats' }],
    }),
  },
  {
    id: 'companion',
    label: 'Companion',
    description: 'The NPC joins the party while this topic runs.',
    build: (key, dialogueId) => ({
      ...base(key, dialogueId, 'Join me'),
      dialogues: [say('Lead the way.')],
      passthrough: [{ key: 'take_a_party', value: 'true' }],
    }),
  },
  {
    id: 'reward',
    label: 'Reward only',
    description: 'Hands out XP without asking anything.',
    build: (key, dialogueId) => ({
      ...base(key, dialogueId, 'Reward'),
      dialogues: [say('Here, take this.')],
      rewards: [{ id: `${key}_rw`, type: 'xp', value: '100' }],
    }),
  },
];

export const findDialogueRecipe = (id: string): DialogueRecipe | undefined =>
  DIALOGUE_RECIPES.find((recipe) => recipe.id === id);

/** New topic id/dialogueId stay unique even when a recipe is added twice. */
export function buildRecipeTree(
  recipe: DialogueRecipe,
  trees: DialogueTree[],
  makeKey: () => string,
  makeDialogueId: () => string,
): DialogueTree {
  const taken = new Set(trees.map((tree) => tree.dialogueId));
  let dialogueId = makeDialogueId();
  while (taken.has(dialogueId)) dialogueId = makeDialogueId();
  return recipe.build(makeKey(), dialogueId);
}
