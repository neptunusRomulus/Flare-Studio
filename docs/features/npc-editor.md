# NPC editor and dialogue

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; verify against
`src/` before trusting a line here — the code wins.

## Edit NPC

- Name and appearance (fantasycore picker, default sprite) are on the first screen. Roles use on/off switches;
  a reserved gear opens the Role center (Dialogue / Shop / Quest).
- Properties list shows only what is set; new keys go through the searchable Add property palette (synonym
  search). Raw Flare keys belong in Tooltips only.
- No engine feature may be removed, only relocated.

## Dialogue

- Dialogue opens as a chat (`src/components/dialogue/MomentChatView.tsx`, helpers in
  `src/editor/dialogueChat.ts`): NPC bubbles left with portrait, player right, "shows when" condition chips,
  effect chips. Deleting a chip or line removes only its own file line.
