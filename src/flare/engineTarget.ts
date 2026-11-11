/**
 * Flare engine target: latest flareteam/flare-engine master, not the official 1.15 tag.
 * Recorded from a fresh clone when this file was last updated.
 */
export const ENGINE_TARGET = {
  repo: 'https://github.com/flareteam/flare-engine',
  branch: 'master',
  /** Full git commit on origin/master. */
  commit: 'c6772106d83b300a67ac53396601880befe71378',
  short: 'c6772106',
  /** Commit date (author), Europe/Istanbul. */
  date: '2026-11-11 04:34 Europe/Istanbul',
  /** Version.cpp ENGINE tuple on that commit. */
  version: '1.15.87',
} as const;
