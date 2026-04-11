const fs = require('fs');
const path = require('path');

const SECTION_HEADER_REGEX = /^\[([^\]]+)\]$/;
const KEY_VALUE_REGEX = /^([A-Za-z0-9_\-.]+)\s*=\s*(.*)$/;
const INCLUDE_REGEX = /^INCLUDE\s+(.+)$/i;
const CODE_FENCE_REGEX = /^```/;

const ALLOWED_SECTIONS = {
  items: new Set(['item', 'quality', 'set', 'type', 'root']),
  maps: new Set(['header', 'tilesets', 'layer', 'event', 'enemy', 'npc', 'root']),
  npcs: new Set(['root', 'dialog', 'stance'])
};

const CATEGORY_PATHS = [
  ['items', `${path.sep}items${path.sep}`],
  ['maps', `${path.sep}maps${path.sep}`],
  ['npcs', `${path.sep}npcs${path.sep}`]
];

function getFlareCategory(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  for (const [category, segment] of CATEGORY_PATHS) {
    if (normalized.includes(segment.split(path.sep).join('/'))) {
      return category;
    }
  }
  return null;
}

function parseFlareDataFile(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  const errors = [];
  const warnings = [];
  const includes = [];

  let currentSection = 'root';
  let currentSectionLine = 1;
  let isInCodeBlock = false;
  let lastEntry = null;

  const ensureSection = (name, line) => {
    if (sections.length === 0 || sections[sections.length - 1].name !== name) {
      sections.push({ name, entries: [], line });
    }
  };

  ensureSection(currentSection, currentSectionLine);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (CODE_FENCE_REGEX.test(line)) {
      isInCodeBlock = !isInCodeBlock;
      continue;
    }

    if (isInCodeBlock || line === '' || line.startsWith('#')) {
      continue;
    }

    const includeMatch = line.match(INCLUDE_REGEX);
    if (includeMatch) {
      const includePath = includeMatch[1].trim();
      if (!includePath) {
        errors.push(`Line ${lineNumber}: INCLUDE directive has no target.`);
      } else {
        includes.push(includePath);
      }
      lastEntry = null;
      continue;
    }

    if (/^[A-Z][_A-Z0-9]*$/.test(line)) {
      lastEntry = null;
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      currentSectionLine = lineNumber;
      ensureSection(currentSection, lineNumber);
      lastEntry = null;
      continue;
    }

    const keyMatch = line.match(KEY_VALUE_REGEX);
    if (keyMatch) {
      const key = keyMatch[1].trim();
      const value = keyMatch[2];
      const entry = { section: currentSection, key, value, line: lineNumber };
      sections[sections.length - 1].entries.push(entry);
      lastEntry = entry;
      continue;
    }

    if (lastEntry) {
      lastEntry.value = `${lastEntry.value}\n${rawLine}`;
      continue;
    }

    errors.push(`Line ${lineNumber}: Invalid line syntax.`);
  }

  return { sections, errors, warnings, includes };
}

function loadFlareDataSchema(root) {
  const schemaPath = path.resolve(root, 'FLARE_DATA_SCHEMA.md');
  const allowedSections = {
    items: new Set(ALLOWED_SECTIONS.items),
    maps: new Set(ALLOWED_SECTIONS.maps),
    npcs: new Set(ALLOWED_SECTIONS.npcs)
  };
  const allowedKeys = {
    items: { item: new Set(), quality: new Set(), set: new Set(), type: new Set(), root: new Set() },
    maps: { header: new Set(), tilesets: new Set(), layer: new Set(), event: new Set(), enemy: new Set(), npc: new Set(), root: new Set() },
    npcs: { root: new Set(), dialog: new Set(), stance: new Set() }
  };

  if (!fs.existsSync(schemaPath)) {
    return { allowedSections, allowedKeys };
  }

  const text = fs.readFileSync(schemaPath, 'utf-8');
  const lines = text.split(/\r?\n/);
  let currentCategory = null;
  let inCodeBlock = false;
  let currentSection = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (CODE_FENCE_REGEX.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock) {
        currentSection = '';
      }
      continue;
    }
    if (!inCodeBlock) {
      if (line.startsWith('### Category:')) {
        const categoryName = line.replace('### Category:', '').trim();
        if (categoryName === 'items' || categoryName === 'maps' || categoryName === 'npcs') {
          currentCategory = categoryName;
        } else {
          currentCategory = null;
        }
      }
      continue;
    }
    if (!currentCategory) {
      continue;
    }
    const sectionMatch = line.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      allowedSections[currentCategory].add(currentSection);
      if (!allowedKeys[currentCategory][currentSection]) {
        allowedKeys[currentCategory][currentSection] = new Set();
      }
      continue;
    }
    const keyMatch = line.match(KEY_VALUE_REGEX);
    if (keyMatch && currentSection) {
      allowedKeys[currentCategory][currentSection].add(keyMatch[1].trim());
    }
  }

  return { allowedSections, allowedKeys };
}

function validateSerializedFlareData(root, filePath, content, schema) {
  const category = getFlareCategory(filePath);
  const errors = [];
  const warnings = [];
  const resolvedSchema = schema || loadFlareDataSchema(root);

  if (!category) {
    return { filePath, category, errors, warnings };
  }

  const parseResult = parseFlareDataFile(content);
  errors.push(...parseResult.errors);

  if (!parseResult.sections.length) {
    errors.push('No sections or key/value entries found.');
  }

  for (const sectionBlock of parseResult.sections) {
    const sectionName = sectionBlock.name || 'root';
    if (!resolvedSchema.allowedSections[category].has(sectionName)) {
      errors.push(`Line ${sectionBlock.line}: Unknown section [${sectionName}] for category ${category}.`);
    }

    for (const entry of sectionBlock.entries) {
      const allowedKeysForSection = resolvedSchema.allowedKeys[category][sectionName];
      if (allowedKeysForSection && allowedKeysForSection.size > 0) {
        if (!allowedKeysForSection.has(entry.key)) {
          warnings.push(`Line ${entry.line}: Unknown key '${entry.key}' in section [${sectionName}] for category ${category}.`);
        }
      }
    }
  }

  for (const includeTarget of parseResult.includes) {
    const baseDir = path.dirname(path.resolve(root, filePath));
    let candidate = path.resolve(baseDir, includeTarget);
    if (!fs.existsSync(candidate)) {
      candidate = path.resolve(root, 'mods', includeTarget);
    }
    if (!fs.existsSync(candidate)) {
      errors.push(`Missing INCLUDE target: ${includeTarget}`);
    }
  }

  return { filePath, category, errors, warnings };
}

module.exports = {
  getFlareCategory,
  parseFlareDataFile,
  loadFlareDataSchema,
  validateSerializedFlareData
};
