import { readFileSync, existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { bookRelPath, mergeBookText, parseBookText } from './bookFile';

function readFlareGameFile(...candidates: string[]): string | null {
  for (const rel of candidates) {
    const path = `/home/ism/Projects/Flare/flare-game/${rel}`;
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return null;
}

const notes = readFlareGameFile(
  'mods/empyrean_campaign/books/il_notes_1.txt',
  'books/il_notes_1.txt',
);
const dead = readFlareGameFile(
  'mods/empyrean_campaign/books/book_of_the_dead.txt',
  'books/book_of_the_dead.txt',
);
const nav = readFlareGameFile(
  'mods/empyrean_campaign/books/il_notes_1_nav.txt',
  'books/il_notes_1_nav.txt',
);
const alchemy = readFlareGameFile(
  'mods/empyrean_campaign/books/crafting_alchemy.txt',
  'books/crafting_alchemy.txt',
);
const wardens = readFlareGameFile(
  'mods/empyrean_campaign/books/wardens_notes.txt',
  'books/wardens_notes.txt',
);
const hasBooks = Boolean(notes && dead);

describe('bookFile', () => {
  describe.skipIf(!hasBooks)('real flare-game books', () => {
    it('round-trips real flare-game books when nothing is edited', () => {
      expect(mergeBookText(notes!, {})).toBe(notes);
      expect(mergeBookText(dead!, {})).toBe(dead);
      if (nav) expect(mergeBookText(nav, {})).toBe(nav);
      if (alchemy) expect(mergeBookText(alchemy, {})).toBe(alchemy);
      if (wardens) expect(mergeBookText(wardens, {})).toBe(wardens);
    });

    it('reads title text and image positions', () => {
      const book = parseBookText(dead!);
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
      const book = parseBookText(notes!);
      const blocks = book.blocks.map((block) => (
        block.kind === 'text' && block.text === '1462/3/10' ? { ...block, x: 200, y: 80 } : block
      ));
      const out = mergeBookText(notes!, { blocks });
      expect(out).toContain('text_pos=200,80,400,left');
      expect(out).toContain('### Page 1');
      expect(out).toContain('text=The dig near Perdition Harbor');
      expect(out).toContain('requires_status=emp_il_notes_1');
      expect(out).not.toContain('text_pos=155,70,400,left');
    });

    it('does not invent pos or align on an INCLUDE navigation book', () => {
      if (!nav) return;
      const book = parseBookText(nav);
      expect(book.present.pos).toBe(false);
      expect(book.present.align).toBe(false);
      const button = book.blocks.find((block) => block.kind === 'button');
      expect(button?.kind).toBe('button');
      if (button?.kind === 'button') {
        expect(button).toMatchObject({ x: 932, y: 600, image: 'images/menus/buttons/right.png' });
        expect(button.components).toEqual([{ key: 'book', value: 'books/il_notes_2_nav.txt' }]);
      }
      expect(mergeBookText(nav, { blocks: book.blocks })).toContain('INCLUDE books/il_notes_1.txt');
      expect(mergeBookText(nav, { blocks: book.blocks })).not.toMatch(/^pos=/m);
    });

    it('parses header sounds, events, buttons, icons and text shadow from the alchemy book', () => {
      if (!alchemy) return;
      const book = parseBookText(alchemy);
      expect(book.soundfxOpen).toBe('soundfx/inventory/inventory_potion.ogg');
      expect(book.soundfxClose).toBe('soundfx/inventory/inventory_book.ogg');
      expect(book.align).toBe('bottom');
      const open = book.blocks.find((block) => block.kind === 'event' && block.section === 'event_open');
      const close = book.blocks.find((block) => block.kind === 'event' && block.section === 'event_close');
      expect(open?.kind === 'event' && open.components).toEqual([{ key: 'script', value: 'scripts/crafting/alchemy/init.txt' }]);
      expect(close?.kind === 'event' && close.components).toEqual([{ key: 'script', value: 'scripts/crafting/alchemy/clear.txt' }]);
      const title = book.blocks.find((block) => block.kind === 'text' && block.text === 'Alchemy');
      expect(title?.kind === 'text' && title.shadow).toBe(true);
      const icon = book.blocks.find((block) => block.kind === 'image' && block.imageIcon === '512');
      expect(icon?.kind).toBe('image');
      const craft = book.blocks.find((block) => block.kind === 'button' && block.text === 'Craft');
      expect(craft?.kind === 'button' && craft.components).toEqual([
        { key: 'requires_status', value: 'emp_alchemy_craft' },
        { key: 'script', value: 'scripts/crafting/alchemy/craft.txt' },
      ]);
    });

    it('patches a moved button and can add a script without dropping comments', () => {
      if (!wardens) return;
      const book = parseBookText(wardens);
      const blocks = book.blocks.map((block) => (
        block.kind === 'button' ? { ...block, x: 900, y: 580 } : block
      ));
      const out = mergeBookText(wardens, { blocks });
      expect(out).toContain('button_pos=900,580');
      expect(out).toContain('# page 1');
      expect(out).toContain('book=books/wardens_notes_2.txt');
      expect(out).toContain('soundfx_open=soundfx/inventory/inventory_page.ogg');
    });
  });

  it('builds a books/ path from a title', () => {
    expect(bookRelPath('Warden\'s Notes')).toBe('books/warden_s_notes.txt');
  });

  it('writes a new button and omits empty event keys', () => {
    const source = `pos=0,0,100,100\nalign=center\n\n[text]\ntext_pos=0,0,40,left\ntext_font=0,0,0,font_regular\ntext=Hi\n`;
    const book = parseBookText(source);
    const out = mergeBookText(source, {
      blocks: [
        ...book.blocks,
        { kind: 'button', x: 10, y: 20, text: 'Next', components: [{ key: 'book', value: 'books/two.txt' }, { key: 'script', value: '' }] },
        { kind: 'event', section: 'event_open', components: [{ key: 'script', value: 'scripts/open.txt' }] },
      ],
    });
    expect(out).toContain('[button]');
    expect(out).toContain('button_pos=10,20');
    expect(out).toContain('text=Next');
    expect(out).toContain('book=books/two.txt');
    expect(out).not.toContain('script=\n');
    expect(out).toContain('[event_open]');
    expect(out).toContain('script=scripts/open.txt');
  });
});
