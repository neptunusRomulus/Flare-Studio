import { describe, expect, it } from 'vitest';
import { authoredConfigText, configDocumentFiles } from './projectFiles';

describe('configDocumentFiles', () => {
  it('writes the engine text and the content/documents sidecar together', () => {
    const files = configDocumentFiles('engine/misc.txt', 'save_hpbar=1\n');
    expect(files.map((file) => file.path)).toEqual([
      'engine/misc.txt',
      'content/documents/engine/misc.txt.json',
    ]);
    expect(files[0].content).toBe(authoredConfigText('engine/misc.txt', 'save_hpbar=1\n'));
    expect(files[1].content).toContain('"path": "engine/misc.txt"');
    expect(files[1].content).toContain(files[0].content.replace(/\n/g, '\\n') === files[0].content ? '"' : '');
    expect(files[1].content.length).toBeGreaterThan(20);
  });

  it('adds APPEND for item type lists', () => {
    const files = configDocumentFiles('items/types.txt', '[type]\nid=foo\nname=Foo\n');
    expect(files[0].content.startsWith('APPEND')).toBe(true);
    expect(files[1].path).toBe('content/documents/items/types.txt.json');
  });
});
