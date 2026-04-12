import fs from 'fs';
import path from 'path';

export type FlareDataCategory = 'items' | 'maps' | 'npcs';

export interface FlareDataEntry {
  section: string;
  key: string;
  value: string;
  line: number;
}

export interface FlareDataFileParseResult {
  sections: Array<{ name: string; entries: FlareDataEntry[]; line: number }>;
  errors: string[];
  includes: string[];
}

export interface FlareDataValidationResult {
  filePath: string;
  category: FlareDataCategory | null;
  errors: string[];
  warnings: string[];
}

const ALLOWED_SECTIONS: Record<FlareDataCategory, Set<string>> = {
  items: new Set(['item', 'quality', 'set', 'type', 'root']),
  maps: new Set(['header', 'tilesets', 'layer', 'event', 'enemy', 'npc', 'root']),
  npcs: new Set(['root', 'dialog', 'stance'])
};

const CATEGORY_PATHS: Array<[FlareDataCategory, string]> = [
  ['items', `${path.sep}items${path.sep}`],
  ['maps', `${path.sep}maps${path.sep}`],
  ['npcs', `${path.sep}npcs${path.sep}`]
];

const SECTION_HEADER_REGEX = /^\[([^\]]+)\]$/;
const KEY_VALUE_REGEX = /^([A-Za-z0-9_\-.]+)\s*=\s*(.*)$/;
const INCLUDE_REGEX = /^INCLUDE\s+(.+)$/i;
const CODE_FENCE_REGEX = /^```/;

export function getFlareCategory(filePath: string): FlareDataCategory | null {
  const normalized = filePath.split(path.sep).join('/');
  for (const [category, segment] of CATEGORY_PATHS) {
    const normalizedSegment = segment.split(path.sep).join('/');
    if (
      normalized.includes(normalizedSegment) ||
      normalized.startsWith(`${category}/`) ||
      normalized.endsWith(`/${category}`)
    ) {
      return category;
    }
  }
  return null;
}

export function parseFlareDataFile(content: string): FlareDataFileParseResult {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ name: string; entries: FlareDataEntry[]; line: number }> = [];
  const errors: string[] = [];
  const includes: string[] = [];

  let currentSection = 'root';
  let currentSectionLine = 1;
  let isInCodeBlock = false;

  const ensureSection = (name: string, line: number) => {
    if (sections.length === 0 || sections[sections.length - 1].name !== name) {
      sections.push({ name, entries: [], line });
    }
  };

  ensureSection(currentSection, currentSectionLine);

  let lastEntry: FlareDataEntry | null = null;

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
      const entry: FlareDataEntry = { section: currentSection, key, value, line: lineNumber };
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

  return { sections, errors, includes };
}

interface SchemaTemplate {
  allowedSections: Record<FlareDataCategory, Set<string>>;
  allowedKeys: Record<FlareDataCategory, Record<string, Set<string>>>;
}

export function loadFlareDataSchema(root: string): SchemaTemplate {
  const schemaPath = path.resolve(root, 'FLARE_DATA_SCHEMA.md');
  const allowedSections = {
    items: new Set(ALLOWED_SECTIONS.items),
    maps: new Set(ALLOWED_SECTIONS.maps),
    npcs: new Set(ALLOWED_SECTIONS.npcs)
  };
  const allowedKeys: Record<FlareDataCategory, Record<string, Set<string>>> = {
    items: { item: new Set(), quality: new Set(), set: new Set(), type: new Set(), root: new Set() },
    maps: { header: new Set(), tilesets: new Set(), layer: new Set(), event: new Set(), enemy: new Set(), npc: new Set(), root: new Set() },
    npcs: { root: new Set(), dialog: new Set(), stance: new Set() }
  };

  if (!fs.existsSync(schemaPath)) {
    return { allowedSections, allowedKeys };
  }

  const text = fs.readFileSync(schemaPath, 'utf-8');
  const lines = text.split(/\r?\n/);
  let currentCategory: FlareDataCategory | null = null;
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
      const key = keyMatch[1].trim();
      allowedKeys[currentCategory][currentSection].add(key);
    }
  }

  return { allowedSections, allowedKeys };
}

export function validateSerializedFlareData(root: string, filePath: string, content: string, schema?: SchemaTemplate): FlareDataValidationResult {
  const category = getFlareCategory(filePath);
  const errors: string[] = [];
  const warnings: string[] = [];
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
    let candidate = path.resolve(path.dirname(path.resolve(root, filePath)), includeTarget);
    if (!fs.existsSync(candidate)) {
      const parts = filePath.split('/');
      const modName = parts.length >= 2 ? parts[1] : '';
      if (modName) {
        candidate = path.resolve(root, 'mods', modName, includeTarget);
      }
    }

    if (!fs.existsSync(candidate)) {
      const modsRoot = path.resolve(root, 'mods');
      if (fs.existsSync(modsRoot)) {
        const mods = fs.readdirSync(modsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);

        for (const otherMod of mods) {
          const alternate = path.resolve(modsRoot, otherMod, includeTarget);
          if (fs.existsSync(alternate)) {
            candidate = alternate;
            break;
          }
        }
      }
    }

    if (!fs.existsSync(candidate)) {
      errors.push(`Missing INCLUDE target: ${includeTarget}`);
    }
  }

  return { filePath, category, errors, warnings };
}

export function validateFlareDataFile(root: string, filePath: string, schema: SchemaTemplate): FlareDataValidationResult {
  const absolutePath = path.resolve(root, filePath);
  const category = getFlareCategory(filePath);

  if (!category) {
    return { filePath, category, errors: [], warnings: [] };
  }

  if (!fs.existsSync(absolutePath)) {
    return { filePath, category, errors: [`File not found: ${filePath}`], warnings: [] };
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  return validateSerializedFlareData(root, filePath, content, schema);
}

export async function findFlareDataFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const resolvedRoot = path.resolve(root);

  async function crawl(directory: string) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        await crawl(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
        const relative = path.relative(resolvedRoot, absolute).split(path.sep).join('/');
        if (getFlareCategory(relative)) {
          results.push(relative);
        }
      }
    }
  }

  if (fs.existsSync(resolvedRoot)) {
    await crawl(resolvedRoot);
  }
  return results;
}

export async function validateAllFlareDataFiles(root: string, schemaRoot?: string): Promise<FlareDataValidationResult[]> {
  const schema = schemaRoot ? loadFlareDataSchema(schemaRoot) : loadFlareDataSchema(root);
  const files = await findFlareDataFiles(root);
  const results: FlareDataValidationResult[] = [];

  for (const filePath of files) {
    const result = validateFlareDataFile(root, filePath, schema);
    results.push(result);
  }

  return results;
}
