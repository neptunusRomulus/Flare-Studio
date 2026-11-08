import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { DIALOGUE_RECIPES, buildRecipeTree, findDialogueRecipe } from '@/editor/dialogueRecipes';

const require = createRequire(import.meta.url);
const { exportDialogueTrees } = require('../adapters/flare/serializers.cjs');

const keys = (text: string) =>
  text.split('\n').map((line: string) => line.split('=')[0].trim()).filter((line: string) => line && line !== '[dialog]');

describe('dialogue recipes', () => {
  it('banker writes stash=true as a real engine action', () => {
    const recipe = findDialogueRecipe('banker')!;
    const tree = buildRecipeTree(recipe, [], () => '1', () => 'dlg_a');
    const text = exportDialogueTrees([tree]);
    expect(text).toContain('id=dlg_a');
    expect(text).toContain('topic=Bank');
    expect(text).toContain('him=Your belongings are safe with me.');
    expect(text).toContain('stash=true');
  });

  it('companion uses take_a_party so the NPC joins the party', () => {
    const text = exportDialogueTrees([buildRecipeTree(findDialogueRecipe('companion')!, [], () => '1', () => 'dlg_b')]);
    expect(text).toContain('take_a_party=true');
  });

  it('reward only hands out XP', () => {
    const text = exportDialogueTrees([buildRecipeTree(findDialogueRecipe('reward')!, [], () => '1', () => 'dlg_c')]);
    expect(text).toContain('reward_xp=100');
  });

  it('every recipe produces a topic with a line and an id', () => {
    for (const recipe of DIALOGUE_RECIPES) {
      const tree = buildRecipeTree(recipe, [], () => '1', () => 'dlg_x');
      expect(tree.dialogueId).toBe('dlg_x');
      expect(tree.topic.length).toBeGreaterThan(0);
      expect(tree.dialogues.length).toBeGreaterThan(0);
      expect(keys(exportDialogueTrees([tree]))).toContain('topic');
    }
  });

  it('a duplicate recipe gets a fresh dialogue id', () => {
    const first = buildRecipeTree(findDialogueRecipe('banker')!, [], () => '1', () => 'dlg_a');
    let n = 0;
    const second = buildRecipeTree(findDialogueRecipe('banker')!, [first], () => '2', () => (n++ === 0 ? 'dlg_a' : 'dlg_b'));
    expect(second.dialogueId).toBe('dlg_b');
  });
});
