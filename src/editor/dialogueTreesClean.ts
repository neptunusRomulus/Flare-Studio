import type { DialogueTree } from '@/types';

/** Trees as they are stored on the NPC: empty topics/lines dropped, editor-only fields stripped. */
export const cleanDialogueTreesForSave = (dialogueTrees: DialogueTree[]): DialogueTree[] => {
  const validTrees = dialogueTrees.filter(tree =>
    tree.topic.trim() && tree.dialogues.some(d => d.text.trim())
  );
  return validTrees.map(tree => ({
              // fields Studio doesn't edit (passthrough, components, ...) ride along
              ...Object.fromEntries(Object.entries(tree).filter(([k]) => !k.startsWith('_'))),
              id: tree.id,
              dialogueId: tree.dialogueId || '',
              topic: tree.topic,
              group: tree.group || undefined,
              responseOnly: tree.responseOnly || false,
              responses: (tree.responses || []).filter(Boolean),
              requirements: tree.requirements.filter(r => r.value.trim()),
              dialogues: tree.dialogues.filter(d => d.text.trim() || d.keepEmpty).map(d => ({
                ...d,
                id: d.id,
                speaker: d.speaker,
                text: d.text,
                ...(d.voice ? { voice: d.voice } : {}),
                ...(d.portrait ? { portrait: d.portrait } : {}),
              })),
              rewards: (tree.rewards || []).filter(r => r.value.trim() || r.type === 'restore'),
              worldEffects: (tree.worldEffects || []).filter(w => w.value.trim())
            })) as DialogueTree[];
};
