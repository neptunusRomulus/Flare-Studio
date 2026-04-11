import path from 'path';
import { describe, it, expect } from 'vitest';
import { loadFlareDataSchema, validateSerializedFlareData } from './utils/flareDataValidator';

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
    const schema = loadFlareDataSchema(projectRoot);
    const badText = `[item]\nid=9001\nunknown_key=value\n`; 
    const result = validateSerializedFlareData(projectRoot, 'mods/my-mod/items/bad_item.txt', badText, schema);

    expect(result.category).toBe('items');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
