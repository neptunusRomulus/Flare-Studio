import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { removeDialogueLine, reorderDialogueLines } from './dialogueLines';

const require = createRequire(import.meta.url);
const { importNpcText, exportNpcFile } = require('../adapters/flare/serializers.cjs');

describe('removeDialogueLine', () => {
  it('keeps later lines and the effect between them in file order', () => {
    const text = '[dialog]\nid=a\nhim=Hello\nset_status=x\nyou=Bye\nreward_xp=10\n';
    const npc = importNpcText(text);
    const tree = npc.customProperties.dialogueTrees[0];
    expect(tree.dialogues.map((d: { text: string }) => d.text)).toEqual(['Hello', 'Bye']);
    const next = removeDialogueLine(tree, 0);
    expect(next.dialogues.map((d: { text: string }) => d.text)).toEqual(['Bye']);
    const out = exportNpcFile({ ...npc, customProperties: { dialogueTrees: [next] } });
    expect(out).toContain('id=a');
    expect(out).toContain('you=Bye');
    expect(out).toContain('reward_xp=10');
    expect(out).toContain('set_status=x');
    expect(out).not.toContain('him=Hello');
    expect(out.indexOf('set_status=x')).toBeLessThan(out.indexOf('you=Bye'));
    expect(out.indexOf('you=Bye')).toBeLessThan(out.indexOf('reward_xp=10'));
  });

  it('drops the portrait/voice prefixes of the deleted line only', () => {
    const text = '[dialog]\nid=a\nportrait_her=p.png\nher=Hi\nvoice=a.ogg\nyou=Ok\n';
    const npc = importNpcText(text);
    const next = removeDialogueLine(npc.customProperties.dialogueTrees[0], 0);
    const out = exportNpcFile({ ...npc, customProperties: { dialogueTrees: [next] } });
    expect(out).toContain('voice=a.ogg\nyou=Ok');
    expect(out).not.toContain('portrait_her');
    expect(out).not.toContain('her=Hi');
  });
});

describe('reorderDialogueLines', () => {
  it('moves only the spoken line span and leaves effects between lines in place', () => {
    const text = '[dialog]\nid=a\nhim=Hello\nset_status=x\nyou=Bye\nreward_xp=10\n';
    const npc = importNpcText(text);
    const tree = npc.customProperties.dialogueTrees[0];
    const next = reorderDialogueLines(tree, 0, 1);
    expect(next.dialogues.map((d: { text: string }) => d.text)).toEqual(['Bye', 'Hello']);
    const out = exportNpcFile({ ...npc, customProperties: { dialogueTrees: [next] } });
    expect(out).toContain('set_status=x');
    expect(out).toContain('reward_xp=10');
    expect(out.indexOf('you=Bye')).toBeLessThan(out.indexOf('him=Hello'));
    expect(out.indexOf('set_status=x')).toBeLessThan(out.indexOf('him=Hello'));
    expect(out.indexOf('you=Bye')).toBeLessThan(out.indexOf('reward_xp=10'));
  });
});
