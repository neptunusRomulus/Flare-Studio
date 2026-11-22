# NPC editor and dialogue

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; verify against
`src/` before trusting a line here — the code wins.

## Acceptance criteria

- [ ] Saving a Talker keeps unknown keys, repeated keys, comments, blank lines and `[dialog]` order — the
  fixtures must stay byte-for-byte. Enforced by `src/adapters/flare/npcRoundTrip.test.ts`.
- [ ] A key the form does not show is reachable through the Add property palette and survives the save.
- [ ] The first screen answers "who is this NPC" (name, appearance, roles) without opening a second tab.

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
