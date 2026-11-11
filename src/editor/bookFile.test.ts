import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeBookText, parseBookText, bookRelPath } from './bookFile';

const notes = readFileSync('/tmp/fg-ref/books/il_notes_1.txt', 'utf8');
const dead = readFileSync('/tmp/fg-ref/books/book_of_the_dead.txt', 'utf8');

describe('bookFile', () => {
  it('round-trips real flare-game books when nothing is edited', () => {
    expect(mergeBookText(notes, {})).toBe(notes);
    expect(mergeBookText(dead, {})).toBe(dead);
  });

  it('reads title text and image positions', () => {
    const book = parseBookText(dead);
    expect(book.pos).toEqual({ x: 0, y: 0, w: 1137, h: 700 });
    expect(book.align).toBe('center');
    expect(book.background).toBe('images/menus/book.png');
    expect(book.close).toEqual({ x: 932, y: 68 });
    const text = book.blocks.find((block) => block.kind === 'text');
    const image = book.blocks.find((block) => block.kind === 'image');
    expect(text?.kind).toBe('text');
    if (text?.kind === 'text') expect(text.x).toBe(169);
    expect(image?.kind).toBe('image');
    if (image?.kind === 'image') expect(image.x).toBe(638);
  });

  it('updates a moved text block and leaves comments and other blocks in place', () => {
    const book = parseBookText(notes);
    const blocks = book.blocks.map((block) => (
      block.kind === 'text' && block.kind === 'text' && block.text === '1462/3/10' ? { ...block, x: 200, y: 80 } : block
    ));
    const out = mergeBookText(notes, { blocks });
    expect(out).toContain('text_pos=200,80,400,left');
    expect(out).toContain('### Page 1');
    expect(out).toContain('text=The dig near Perdition Harbor');
    expect(out).toContain('requires_status=emp_il_notes_1');
    expect(out).not.toContain('text_pos=155,70,400,left');
  });

  it('builds a books/ path from a title', () => {
    expect(bookRelPath('Warden\'s Notes')).toBe('books/warden_s_notes.txt');
  });
});
