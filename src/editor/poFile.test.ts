import { describe, expect, it } from 'vitest';
import {
  dataPoPath,
  defaultLanguageName,
  emptyPo,
  entryKey,
  escapePo,
  mergeCatalogIntoPo,
  normalizeLanguageCode,
  parseLanguagesTxt,
  parsePo,
  serializeLanguagesTxt,
  serializePo,
  translationProgress,
  unescapePo,
} from './poFile';

const SAMPLE = `# Language: tr
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: tr\\n"

#: items/sword.txt
msgid "Iron Sword"
msgstr "Demir Kılıç"

msgctxt "vendor"
msgid "Buy"
msgstr "Satın al"

msgid "Line one\\nLine two"
msgstr ""

#, fuzzy
msgid "Old name"
msgstr "Eski"

#~ msgid "Removed"
#~ msgstr "Silindi"
`;

describe('PO escape', () => {
  it('round-trips quotes, newlines and backslashes', () => {
    const raw = 'Say "hi"\\nand C:\\path';
    expect(unescapePo(escapePo(raw))).toBe(raw);
  });
});

describe('parsePo / serializePo', () => {
  it('round-trips header, msgctxt, fuzzy, multiline and obsolete entries', () => {
    const parsed = parsePo(SAMPLE);
    expect(parsed.header).toContain('Content-Type: text/plain; charset=UTF-8\n');
    expect(parsed.header).toContain('Language: tr\n');
    expect(parsed.entries).toHaveLength(5);
    expect(parsed.entries[0]).toMatchObject({ msgid: 'Iron Sword', msgstr: 'Demir Kılıç', obsolete: false });
    expect(parsed.entries[0].comments[0]).toContain('items/sword.txt');
    expect(parsed.entries[1]).toMatchObject({ msgctxt: 'vendor', msgid: 'Buy', msgstr: 'Satın al' });
    expect(parsed.entries[2].msgid).toBe('Line one\nLine two');
    expect(parsed.entries[3].flags).toContain('fuzzy');
    expect(parsed.entries[4]).toMatchObject({ msgid: 'Removed', msgstr: 'Silindi', obsolete: true });

    const again = parsePo(serializePo(parsed));
    expect(again.header).toBe(parsed.header);
    expect(again.entries).toEqual(parsed.entries);
  });

  it('parses official-style one-line entries and ignores the empty header msgid', () => {
    const text = [
      'msgid ""',
      'msgstr ""',
      '"Content-Type: text/plain; charset=UTF-8\\n"',
      '',
      'msgid "Cancel"',
      'msgstr "İptal"',
      '',
    ].join('\n');
    const parsed = parsePo(text);
    expect(parsed.entries).toEqual([
      { comments: [], flags: [], msgctxt: null, msgid: 'Cancel', msgstr: 'İptal', obsolete: false },
    ]);
  });
});

describe('mergeCatalogIntoPo', () => {
  it('adds new strings empty, preserves translations, and marks removed strings obsolete', () => {
    const existing = parsePo(SAMPLE);
    const merged = mergeCatalogIntoPo(existing, [
      { msgid: 'Iron Sword', comments: ['#: items/sword.txt'] },
      { msgid: 'A new line' },
      { msgctxt: 'vendor', msgid: 'Buy' },
    ]);
    const byKey = new Map(merged.entries.map((entry) => [entryKey(entry.msgctxt, entry.msgid), entry]));
    expect(byKey.get(entryKey(null, 'Iron Sword'))).toMatchObject({ msgstr: 'Demir Kılıç', obsolete: false });
    expect(byKey.get(entryKey(null, 'A new line'))).toMatchObject({ msgstr: '', obsolete: false });
    expect(byKey.get(entryKey('vendor', 'Buy'))).toMatchObject({ msgstr: 'Satın al', obsolete: false });
    expect(byKey.get(entryKey(null, 'Line one\nLine two'))).toMatchObject({ obsolete: true, msgstr: '' });
    expect(byKey.get(entryKey(null, 'Old name'))).toMatchObject({ obsolete: true, msgstr: 'Eski' });
    expect(byKey.get(entryKey(null, 'Removed'))).toMatchObject({ obsolete: true, msgstr: 'Silindi' });
    const revived = mergeCatalogIntoPo(merged, [{ msgid: 'Removed' }]);
    expect(revived.entries.find((entry) => entry.msgid === 'Removed')).toMatchObject({ obsolete: false, msgstr: 'Silindi' });
  });
});

describe('translationProgress', () => {
  it('counts only active entries', () => {
    expect(translationProgress(parsePo(SAMPLE))).toEqual({ total: 4, done: 3 });
    expect(translationProgress(emptyPo('tr'))).toEqual({ total: 0, done: 0 });
  });
});

describe('languages.txt', () => {
  it('parses code=name, skips comments and APPEND, and always keeps English first', () => {
    const parsed = parseLanguagesTxt('# comment\nAPPEND\nde=Deutsch\ntr=Türkçe\nen=English\nbad\npt-br=Português (Brasil)\n');
    expect(parsed).toEqual([
      { code: 'en', name: 'English' },
      { code: 'de', name: 'Deutsch' },
      { code: 'tr', name: 'Türkçe' },
      { code: 'pt_BR', name: 'Português (Brasil)' },
    ]);
  });

  it('serializes Flare engine/languages.txt without APPEND', () => {
    const text = serializeLanguagesTxt([{ code: 'tr', name: 'Türkçe' }]);
    expect(text).toContain('en=English');
    expect(text).toContain('tr=Türkçe');
    expect(text).not.toContain('APPEND');
    expect(parseLanguagesTxt(text)).toEqual([
      { code: 'en', name: 'English' },
      { code: 'tr', name: 'Türkçe' },
    ]);
  });

  it('normalizes language codes and names data.po paths', () => {
    expect(normalizeLanguageCode('TR')).toBe('tr');
    expect(normalizeLanguageCode('pt-br')).toBe('pt_BR');
    expect(normalizeLanguageCode('1x')).toBeNull();
    expect(defaultLanguageName('tr')).toBe('Türkçe');
    expect(dataPoPath('tr')).toBe('languages/data.tr.po');
  });
});
