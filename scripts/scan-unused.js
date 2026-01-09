/* eslint-disable */
/* eslint-enable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function readAllSourceFiles() {
  return glob.sync('src/**/*.{ts,tsx,js,jsx}', { nodir: true }).map(p => path.normalize(p));
}

function listFiles(pattern) {
  return glob.sync(pattern, { nodir: true }).map(p => path.normalize(p));
}

function basenameNoExt(p) {
  return path.basename(p).replace(/\.[^.]+$/, '');
}

function fileContentsMap(files) {
  const map = new Map();
  for (const f of files) {
    try {
      map.set(f, fs.readFileSync(f, 'utf8'));
    } catch {
      map.set(f, '');
    }
  }
  return map;
}

(async function main() {
  const compFiles = listFiles('src/components/**/*.tsx');
  const hookFiles = listFiles('src/hooks/**/*.{ts,tsx}');
  const allSrc = readAllSourceFiles();
  const contents = fileContentsMap(allSrc);

  const candidates = [];

  function analyze(files) {
    for (const f of files) {
      const name = basenameNoExt(f);
      const regex = new RegExp('\\b' + name.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'g');
      let total = 0;
      let external = 0;
      const hits = [];
      for (const s of allSrc) {
        const txt = contents.get(s) || '';
        let count = 0;
        while (regex.exec(txt) !== null) count++;
        if (count) {
          total += count;
          hits.push({ path: s, count });
          if (path.normalize(s) !== path.normalize(f)) external += count;
        }
      }
      if (external === 0) {
        candidates.push({ file: f, name, total, external, hits });
      }
    }
  }

  analyze(compFiles);
  analyze(hookFiles);

  const out = [];
  out.push('# Unused / Unwired File Candidates Report');
  out.push('Generated: ' + new Date().toISOString());
  out.push('');
  out.push('Files whose basename has no references outside their own file (candidates):');
  out.push('');
  if (!candidates.length) {
    out.push('_No candidates found — every scanned file had at least one external reference._');
  } else {
    for (const c of candidates) {
      out.push('## ' + c.name);
      out.push('- File: ' + c.file);
      out.push('- Total matches: ' + c.total + ', external matches: ' + c.external);
      out.push('- Example hits:');
      for (const h of c.hits.slice(0,5)) {
        out.push('  - ' + h.path + ' (' + h.count + ')');
      }
      out.push('');
    }
  }

  fs.writeFileSync('unused-files-report.md', out.join('\n'));
  console.log('Report written to unused-files-report.md — candidates:', candidates.length);
})();
