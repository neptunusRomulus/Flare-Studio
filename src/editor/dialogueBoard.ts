/**
 * Story board data: every dialogue topic as a card with its outgoing links
 * and the problems Flare will hit at runtime (missing targets, duplicate ids).
 */
import type { DialogueTree } from '@/types';

export type DialogueBoardLink = {
  dialogueId: string;
  /** Topic name of the target, or null when nothing in the file has that id. */
  label: string | null;
};

export type DialogueBoardCard = {
  index: number;
  dialogueId: string;
  topic: string;
  lineCount: number;
  responseOnly: boolean;
  links: DialogueBoardLink[];
  /** True when no other topic points to this one. */
  orphan: boolean;
  warnings: string[];
};

export function buildDialogueBoard(trees: DialogueTree[]): DialogueBoardCard[] {
  const ids = trees.map((tree) => String(tree.dialogueId || '').trim());
  const idCount = new Map<string, number>();
  for (const id of ids) {
    if (id) idCount.set(id, (idCount.get(id) || 0) + 1);
  }
  const byId = new Map<string, DialogueTree>();
  trees.forEach((tree, index) => {
    const id = ids[index];
    if (id && !byId.has(id)) byId.set(id, tree);
  });
  const referenced = new Set<string>();
  for (const tree of trees) {
    for (const response of tree.responses || []) {
      if (response) referenced.add(response);
    }
  }

  return trees.map((tree, index) => {
    const dialogueId = ids[index];
    const links: DialogueBoardLink[] = (tree.responses || []).filter(Boolean).map((response) => {
      const target = byId.get(response);
      return { dialogueId: response, label: target ? String(target.topic || target.dialogueId) : null };
    });
    const lineCount = (tree.dialogues || []).filter((line) => line.text.trim()).length;
    const warnings: string[] = [];
    if (!dialogueId) warnings.push('No dialogue id');
    else if ((idCount.get(dialogueId) || 0) > 1) warnings.push('Duplicate dialogue id');
    if (lineCount === 0) warnings.push('No lines yet');
    for (const link of links) {
      if (!link.label) warnings.push(`Missing target: ${link.dialogueId}`);
    }
    const orphan = Boolean(dialogueId) && !referenced.has(dialogueId) && !tree.responseOnly;

    return {
      index,
      dialogueId,
      topic: String(tree.topic || '').trim() || `Dialogue ${index + 1}`,
      lineCount,
      responseOnly: Boolean(tree.responseOnly),
      links,
      orphan,
      warnings,
    };
  });
}

export const boardWarningCount = (cards: DialogueBoardCard[]): number =>
  cards.reduce((sum, card) => sum + card.warnings.length, 0);
