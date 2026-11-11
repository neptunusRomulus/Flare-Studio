import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import {
  DEFAULT_BOOK_TEMPLATE,
  mergeBookText,
  parseBookText,
  type BookBlock,
  type BookFile,
  type BookImageBlock,
  type BookTextBlock,
} from '@/editor/bookFile';

export const OPEN_BOOK_EVENT = 'flare-studio:open-book';

type Props = { projectPath: string | null | undefined };

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const mediaSrc = (root: string, rel: string) => {
  if (!rel) return '';
  if (/^https?:|^data:|^file:/.test(rel)) return rel;
  return `file://${projectFile(root, rel)}`;
};

const BookEditorView = ({ projectPath }: Props) => {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [rel, setRel] = useState('');
  const [text, setText] = useState('');
  const [book, setBook] = useState<BookFile>(() => parseBookText(DEFAULT_BOOK_TEMPLATE));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; dx: number; dy: number } | null>(null);

  const load = useCallback(async (path: string) => {
    if (!root || !window.electronAPI?.readFile) return;
    const next = (await window.electronAPI.readFile(projectFile(root, path))) || DEFAULT_BOOK_TEMPLATE;
    setRel(path);
    setText(next);
    setBook(parseBookText(next));
    setDirty(false);
    setSelected(null);
  }, [root]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      if (path) void load(path);
    };
    window.addEventListener(OPEN_BOOK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BOOK_EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const fit = () => {
      const pad = 48;
      const sx = (node.clientWidth - pad) / Math.max(book.pos.w, 1);
      const sy = (node.clientHeight - pad) / Math.max(book.pos.h, 1);
      setScale(Math.max(0.2, Math.min(1, sx, sy)));
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(node);
    return () => obs.disconnect();
  }, [book.pos.w, book.pos.h]);

  const changeBlocks = (blocks: BookBlock[]) => {
    setBook((prev) => ({ ...prev, blocks }));
    setDirty(true);
  };

  const moveBlock = (index: number, x: number, y: number) => {
    changeBlocks(book.blocks.map((block, i) => {
      if (i !== index) return block;
      if (block.kind === 'text' || block.kind === 'image') return { ...block, x, y };
      return block;
    }));
  };

  const startDrag = (index: number, event: ReactMouseEvent, block: BookTextBlock | BookImageBlock) => {
    event.preventDefault();
    setSelected(index);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = block.x;
    const originY = block.y;
    drag.current = { index, dx: 0, dy: 0 };
    const onMove = (e: MouseEvent) => {
      const x = Math.round(originX + (e.clientX - startX) / scale);
      const y = Math.round(originY + (e.clientY - startY) / scale);
      moveBlock(index, x, y);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      drag.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const save = async () => {
    if (!root || !rel || !window.electronAPI?.writeFile) return;
    const next = mergeBookText(text, { pos: book.pos, align: book.align, close: book.close, background: book.background, blocks: book.blocks });
    await window.electronAPI.writeFile(projectFile(root, rel), next);
    setText(next);
    setDirty(false);
  };

  const addText = () => {
    const block: BookTextBlock = {
      kind: 'text', text: 'New text', x: 155, y: 120, width: 400, justify: 'left',
      fontColor: { r: 0, g: 0, b: 0 }, fontStyle: 'font_regular',
    };
    changeBlocks([...book.blocks, block]);
    setSelected(book.blocks.length);
  };
  const addImage = () => {
    const block: BookImageBlock = { kind: 'image', x: 600, y: 120, image: '' };
    changeBlocks([...book.blocks, block]);
    setSelected(book.blocks.length);
  };
  const removeSelected = () => {
    if (selected == null) return;
    changeBlocks(book.blocks.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const selectedBlock = selected != null ? book.blocks[selected] : null;
  const pageStyle = useMemo(() => ({
    width: book.pos.w,
    height: book.pos.h,
    transform: `scale(${scale})`,
    transformOrigin: 'top left' as const,
    backgroundColor: '#5a3d2b',
    backgroundImage: book.background && root ? `url("${mediaSrc(root, book.background)}")` : undefined,
    backgroundSize: '100% 100%',
    position: 'relative' as const,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  }), [book.pos, book.background, root, scale]);

  if (!root) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Open a project to edit books.</div>;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-sm font-semibold truncate flex-1">{rel || 'Book'}</div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addText}><Plus className="w-3 h-3 mr-1" /> Text</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addImage}><Plus className="w-3 h-3 mr-1" /> Image</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={selected == null} onClick={removeSelected} aria-label="Remove block">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Tooltip content="Save books/*.txt">
          <Button type="button" size="sm" className="h-7" disabled={!rel || !dirty} onClick={() => void save()}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>
      <div ref={frameRef} className="flex-1 overflow-auto p-4 bg-muted/30">
        <div style={{ width: book.pos.w * scale, height: book.pos.h * scale }}>
          <div style={pageStyle}>
            {book.blocks.map((block, index) => {
              if (block.kind === 'text') {
                return (
                  <textarea
                    key={`t-${index}`}
                    value={block.text}
                    onChange={(e) => changeBlocks(book.blocks.map((entry, i) => (i === index && entry.kind === 'text' ? { ...entry, text: e.target.value } : entry)))}
                    onMouseDown={(e) => startDrag(index, e, block)}
                    onClick={() => setSelected(index)}
                    className="absolute bg-transparent resize-none outline-none overflow-hidden"
                    style={{
                      left: block.x,
                      top: block.y,
                      width: block.width,
                      color: `rgb(${block.fontColor.r},${block.fontColor.g},${block.fontColor.b})`,
                      textAlign: block.justify,
                      fontFamily: block.fontStyle.includes('cursive') ? 'cursive' : 'serif',
                      fontSize: block.fontStyle.includes('big') ? 28 : 16,
                      textShadow: block.shadow ? '1px 1px 0 #000' : undefined,
                      outline: selected === index ? '1px dashed rgba(255,255,255,0.8)' : undefined,
                      cursor: 'move',
                    }}
                  />
                );
              }
              if (block.kind === 'image') {
                return (
                  <img
                    key={`i-${index}`}
                    alt=""
                    src={block.image && root ? mediaSrc(root, block.image) : undefined}
                    onMouseDown={(e) => startDrag(index, e, block)}
                    onClick={() => setSelected(index)}
                    className="absolute max-w-none select-none"
                    style={{
                      left: block.x,
                      top: block.y,
                      outline: selected === index ? '1px dashed rgba(255,255,255,0.8)' : undefined,
                      cursor: 'move',
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
      {selectedBlock && selectedBlock.kind === 'image' && (
        <div className="border-t border-border px-3 py-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">image</span>
          <Input
            className="h-7 font-mono text-xs"
            value={selectedBlock.image}
            onChange={(e) => changeBlocks(book.blocks.map((entry, i) => (i === selected && entry.kind === 'image' ? { ...entry, image: e.target.value } : entry)))}
            placeholder="images/books/page.png"
          />
        </div>
      )}
    </div>
  );
};

export default BookEditorView;
