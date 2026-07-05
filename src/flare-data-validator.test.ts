import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { SchemaTemplate, loadFlareDataSchema, validateSerializedFlareData, findFlareDataFiles, validateFlareDataFile } from './utils/flareDataValidator';

const projectRoot = path.resolve(process.cwd());

describe('Flare Data Validator', () => {
  it('should validate serialized .txt output against the reference schema derived from mods', () => {
    const schema = loadFlareDataSchema(projectRoot);
    const sampleText = `[item]\nid=9001\nname=Test Item\nquality=normal\nitem_type=artifact\nicon=999\n`;
    const result = validateSerializedFlareData(projectRoot, 'mods/my-mod/items/test_item.txt', sampleText, schema);

    expect(result.category).toBe('items');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should reject serialized output with invalid section or unknown key', () => {
    const schema: SchemaTemplate = {
      allowedSections: {
        items: new Set(['item', 'quality', 'set', 'type', 'root']),
        maps: new Set(['header', 'tilesets', 'layer', 'event', 'enemy', 'npc', 'root']),
        npcs: new Set(['root', 'dialog', 'stance'])
      },
      allowedKeys: {
        items: { item: new Set(['id', 'name', 'quality', 'item_type', 'icon']) },
        maps: { header: new Set() },
        npcs: { root: new Set() }
      } as Record<FlareDataCategory, Record<string, Set<string>>>
    };
    const badText = `[item]\nid=9001\nunknown_key=value\n`;
    const result = validateSerializedFlareData(projectRoot, 'mods/my-mod/items/bad_item.txt', badText, schema);

    expect(result.category).toBe('items');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should validate exported .txt files against the Flare schema using mods as reference', async () => {
    const schema = loadFlareDataSchema(projectRoot);
    const exportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-export-'));
    const exportItemsDir = path.join(exportRoot, 'items');
    fs.mkdirSync(exportItemsDir, { recursive: true });

    const itemContent = `[item]\nid=9001\nname=Temp Item\nquality=normal\nitem_type=artifact\nicon=999\n`;
    fs.writeFileSync(path.join(exportItemsDir, 'temp_item.txt'), itemContent, 'utf8');

    const files = await findFlareDataFiles(exportRoot);
    expect(files).toContain('items/temp_item.txt');

    const invalidFiles = files
      .map((filePath) => validateFlareDataFile(exportRoot, filePath, schema))
      .filter((result) => result.errors.length > 0);

    expect(invalidFiles).toEqual([]);
  });
});
