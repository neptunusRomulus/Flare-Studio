# <Area> — <what this covers in one line>

Hints, not contracts: verify against `src/` before trusting a line.
Keep this file to what a reader cannot get from the code in ten seconds.

## What the user can do

Plain-language outcomes, the way the owner would describe them, not the Flare keys behind them.

- …
- …

## Acceptance criteria

Written **before** the code, one line per provable outcome. A criterion is a sentence a test or a
five-second manual check can settle; "works well" is not a criterion. Delete the ones the change did
not need instead of leaving them unticked.

- [ ] Saving a Talker keeps unknown keys — covered by `src/adapters/flare/npcRoundTrip.test.ts`
- [ ] The panel does not resize when the third row is added
- [ ] …

## Where it lives

| Concern | File |
|---|---|
| … | `src/…` |

## Known traps

Only what already cost someone an afternoon: a key that looks optional but is not, an order that
matters, a window that steals focus.

- …
