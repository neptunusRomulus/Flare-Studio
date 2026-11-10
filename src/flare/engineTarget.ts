/**
 * Flare engine target: latest flareteam/flare-engine master, not the official 1.15 tag.
 * Recorded from a fresh clone when this file was last updated.
 */
export const ENGINE_TARGET = {
  repo: 'https://github.com/flareteam/flare-engine',
  branch: 'master',
  /** Full git commit on origin/master. */
  commit: 'f9a17a266293a897a1d7eae2d54408b0de39af27',
  short: 'f9a17a26',
  /** Commit date (author), Europe/Istanbul. */
  date: '2026-10-30 00:51 Europe/Istanbul',
  /** Version.cpp ENGINE tuple on that commit. */
  version: '1.15.86',
} as const;
