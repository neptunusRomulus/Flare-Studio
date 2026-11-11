"use strict";

const DIRECTIVES = new Set(["INCLUDE", "APPEND"]);

/**
 * Walk a Flare key=value file and yield each key in its section block.
 * Layer `data=` raw rows are skipped. Comments and INCLUDE/APPEND lines are skipped.
 */
function parseFlareEntries(text) {
  const entries = [];
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  let section = "";
  let dataLeft = 0;
  let block = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (dataLeft > 0) {
      if (line.startsWith("[") && line.endsWith("]")) {
        dataLeft = 0;
      } else {
        dataLeft -= 1;
        continue;
      }
    }
    if (!line || line.startsWith("#")) continue;
    const first = line.split(/\s+/, 1)[0];
    if (DIRECTIVES.has(first)) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      block += 1;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    if (section === "layer" && key === "data") {
      dataLeft = Infinity; // consume until next section; dataLeft reset above
      // Keep the data= key itself (empty value is fine)
      entries.push({ section, key, value, block });
      dataLeft = Number.MAX_SAFE_INTEGER;
      continue;
    }
    entries.push({ section, key, value, block });
  }
  return entries;
}

function groupRepeats(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const id = `${entry.block}\0${entry.section}\0${entry.key}`;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => {
      const [block, section, key] = id.split("\0");
      return { block: Number(block), section, key, count };
    });
}

module.exports = { parseFlareEntries, groupRepeats, DIRECTIVES };
