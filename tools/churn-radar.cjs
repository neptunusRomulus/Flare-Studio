#!/usr/bin/env node
/**
 * Churn radar: which files does every change keep touching?
 *
 * A file that changes in almost every commit is usually a boundary problem, not
 * a busy file: one component owning two concerns, a config that carries state, a
 * doc that carries what the code should say. This prints the ranking so the
 * monthly ritual has a name and a number instead of a feeling.
 *
 * Usage:
 *   node tools/churn-radar.cjs                 # last 30 days
 *   node tools/churn-radar.cjs --since 7       # weekly ritual
 *   node tools/churn-radar.cjs --since 30 --threshold 5 --limit 25
 *
 * Report only: it never fails the build. Read it, then decide.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const since = arg('since', 30);
const threshold = arg('threshold', 4);
const limit = arg('limit', 20);

let log;
try {
  log = execFileSync(
    'git',
    [
      'log',
      `--since=${since} days ago`,
      '--name-only',
      '--pretty=format:@@%h%x09%ad',
      '--date=short',
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
} catch (error) {
  console.error('git log failed:', error.message);
  process.exit(1);
}

const counts = new Map();
const commits = [];
let current = null;

for (const line of log.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  if (trimmed.startsWith('@@')) {
    const [hash, date] = trimmed.slice(2).split('\t');
    current = { hash, date, files: 0 };
    commits.push(current);
    continue;
  }
  counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
  if (current) current.files += 1;
}

if (commits.length === 0) {
  console.log(`No commits in the last ${since} days.`);
  process.exit(0);
}

const first = commits[commits.length - 1];
const last = commits[0];
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const hot = ranked.filter(([, count]) => count >= threshold);
const shown = ranked.slice(0, limit);

console.log(`## Churn — last ${since} days`);
console.log(`Commits: ${commits.length} (${first.hash}, ${first.date} … ${last.hash}, ${last.date}) · distinct files: ${ranked.length}`);
console.log('');
console.log('| # | File | Touches |');
console.log('|---:|---|---:|');
shown.forEach(([file, count], index) => {
  const flag = count >= threshold ? ' **' : '';
  console.log(`| ${index + 1} | \`${file}\`${flag} | ${count} |`);
});
console.log('');

if (hot.length === 0) {
  console.log(`No file reached ${threshold} touches — nothing is churning.`);
} else {
  console.log(`Hot files (\u2265 ${threshold} touches, bold above): ${hot.length}`);
  for (const [file, count] of hot.slice(0, limit)) {
    console.log(`- \`${file}\` \u2014 ${count}`);
  }
  if (hot.length > limit) console.log(`- …and ${hot.length - limit} more`);
  console.log('');
  console.log('Ask of each: does this file own one thing? A hot file is often two concerns sharing a name.');
  console.log('Split it, or move the volatile part out (generated data, config, tests).');
}
