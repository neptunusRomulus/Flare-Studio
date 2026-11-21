import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { FlareColorField } from '@/components/ui/flare-color-field';
import Tooltip from '@/components/ui/tooltip';
import EventComponentsEditor from '@/components/events/EventComponentsEditor';
import {
  BOOK_ALIGNMENTS,
  DEFAULT_BOOK_SIZE,
  DEFAULT_BOOK_TEMPLATE,
  mergeBookText,
  parseBookText,
  type BookBlock,
  type BookButtonBlock,
  type BookEventComponent,
  type BookEventBlock,
  type BookFile,
  type BookHeaderKey,
  type BookImageBlock,
  type BookJustify,
  type BookPresent,
  type BookTextBlock,
} from '@/editor/bookFile';
import { useRegisterDirty } from '@/context/SaveHealthContext';

export const OPEN_BOOK_EVENT = 'flare-studio:open-book';

type Props = { projectPath: string | null | undefined };

const GRID = 8;

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const mediaSrc = (root: string, rel: string) => {
  if (!rel) return '';
  if (/^https?:|^data:|^file:/.test(rel)) return rel;
  return `file://${projectFile(root, rel)}`;
};

const snapTo = (value: number, snap: boolean) => (snap ? Math.round(value / GRID) * GRID : Math.round(value));

async function listTxtFiles(root: string, rel: string): Promise<string[]> {
  const api = window.electronAPI;
  if (!root || !api?.readDir) return [];
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = (await api.readDir(projectFile(root, dir)).catch(() => [])) || [];
    for (const entry of entries) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory) await walk(next);
      else if (entry.name.endsWith('.txt')) out.push(next);
    }
  };
  await walk(rel);
  return out.sort();
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <HintLabel className="text-xs font-normal w-28 shrink-0" hint={hint}>{label}</HintLabel>
      {children}
    </div>
  );
}

const BookEditorView = ({ projectPath }: Props) => {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [rel, setRel] = useState('');
  const [text, setText] = useState('');
  const [book, setBook] = useState<BookFile>(() => parseBookText(DEFAULT_BOOK_TEMPLATE));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [snap, setSnap] = useState(false);
  const [scripts, setScripts] = useState<string[]>([]);
  const [books, setBooks] = useState<string[]>([]);
  const [cutscenes, setCutscenes] = useState<string[]>([]);
  const frameRef = useRef<HTMLDivElement>(null);

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
    if (!root) return;
    void Promise.all([
      listTxtFiles(root, 'scripts'),
      listTxtFiles(root, 'books'),
      listTxtFiles(root, 'cutscenes'),
    ]).then(([nextScripts, nextBooks, nextCutscenes]) => {
      setScripts(nextScripts);
      setBooks(nextBooks);
      setCutscenes(nextCutscenes);
    });
  }, [root]);

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

  const markBook = (next: BookFile) => {
    setBook(next);
    setDirty(true);
  };

  const changeBlocks = (blocks: BookBlock[]) => markBook({ ...book, blocks });

  const touchHeader = (patch: Partial<BookFile>, key: BookHeaderKey) => {
    const present: BookPresent = { ...book.present, [key]: true };
    markBook({ ...book, ...patch, present });
  };

  const updateBlock = (index: number, next: BookBlock) => {
    changeBlocks(book.blocks.map((block, i) => (i === index ? next : block)));
  };

  const moveBlock = (index: number, x: number, y: number) => {
    changeBlocks(book.blocks.map((block, i) => {
      if (i !== index) return block;
      if (block.kind === 'text' || block.kind === 'image' || block.kind === 'button') return { ...block, x, y };
      return block;
    }));
  };

  const startDrag = (index: number, event: ReactMouseEvent, block: BookTextBlock | BookImageBlock | BookButtonBlock) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(index);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = block.x;
    const originY = block.y;
    const onMove = (e: MouseEvent) => {
      moveBlock(index, snapTo(originX + (e.clientX - startX) / scale, snap), snapTo(originY + (e.clientY - startY) / scale, snap));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startCloseDrag = (event: ReactMouseEvent) => {
    if (!book.close) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = book.close.x;
    const originY = book.close.y;
    const onMove = (e: MouseEvent) => {
      touchHeader({ close: { x: snapTo(originX + (e.clientX - startX) / scale, snap), y: snapTo(originY + (e.clientY - startY) / scale, snap) } }, 'close');
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const save = async () => {
    if (!root || !rel || !window.electronAPI?.writeFile) return;
    const next = mergeBookText(text, {
      pos: book.pos,
      align: book.align,
      close: book.close ?? null,
      background: book.background,
      soundfxOpen: book.soundfxOpen ?? null,
      soundfxClose: book.soundfxClose ?? null,
      present: book.present,
      blocks: book.blocks,
    });
    await window.electronAPI.writeFile(projectFile(root, rel), next);
    setText(next);
    setDirty(false);
  };

  useRegisterDirty('books', dirty, save);

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
  const addButton = () => {
    const block: BookButtonBlock = { kind: 'button', x: 600, y: 400, text: 'Button', components: [] };
    changeBlocks([...book.blocks, block]);
    setSelected(book.blocks.length);
  };
  const addEvent = (section: BookEventBlock['section']) => {
    if (book.blocks.some((block) => block.kind === 'event' && block.section === section)) return;
    const block: BookEventBlock = { kind: 'event', section, components: [{ key: 'script', value: '' }] };
    changeBlocks([...book.blocks, block]);
    setSelected(book.blocks.length);
  };
  const removeSelected = () => {
    if (selected == null) return;
    changeBlocks(book.blocks.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const selectedBlock = selected != null ? book.blocks[selected] : null;
  const hasOpen = book.blocks.some((block) => block.kind === 'event' && block.section === 'event_open');
  const hasClose = book.blocks.some((block) => block.kind === 'event' && block.section === 'event_close');
  const pageStyle = useMemo(() => ({
    width: book.pos.w || DEFAULT_BOOK_SIZE.w,
    height: book.pos.h || DEFAULT_BOOK_SIZE.h,
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
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addButton}><Plus className="w-3 h-3 mr-1" /> Button</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={hasOpen} onClick={() => addEvent('event_open')}>Open event</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={hasClose} onClick={() => addEvent('event_close')}>Close event</Button>
        <FieldHint hint="When on, dragging snaps block positions to an 8-pixel grid, like the power tree snap. Off by default because many books use odd coordinates.">
          <label className="flex items-center gap-1 text-xs">
            <Checkbox checked={snap} onCheckedChange={(value) => setSnap(value === true)} />
            Snap
          </label>
        </FieldHint>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={selected == null} onClick={removeSelected} aria-label="Remove block">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Tooltip content="Save books/*.txt">
          <Button type="button" size="sm" className="h-7" disabled={!rel || !dirty} onClick={() => void save()}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1">
        <div ref={frameRef} className="flex-1 overflow-auto p-4 bg-muted/30">
          <div style={{ width: (book.pos.w || DEFAULT_BOOK_SIZE.w) * scale, height: (book.pos.h || DEFAULT_BOOK_SIZE.h) * scale }}>
            <div style={pageStyle}>
              {book.close ? (
                <button
                  type="button"
                  aria-label="Close button"
                  onMouseDown={startCloseDrag}
                  className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-background/80 text-xs"
                  style={{ left: book.close.x, top: book.close.y, cursor: 'move' }}
                >
                  ×
                </button>
              ) : null}
              {book.blocks.map((block, index) => {
                if (block.kind === 'text') {
                  return (
                    <div key={`t-${index}`} className="absolute" style={{ left: block.x, top: block.y, width: block.width, outline: selected === index ? '1px dashed rgba(255,255,255,0.8)' : undefined }}>
                      <button type="button" aria-label="Move text" className="absolute -left-2 -top-2 z-10 h-3 w-3 rounded-sm bg-orange-500" onMouseDown={(event) => startDrag(index, event, block)} />
                      <textarea
                        value={block.text}
                        onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                        onClick={() => setSelected(index)}
                        className="w-full bg-transparent resize-none outline-none overflow-hidden"
                        style={{
                          color: `rgb(${block.fontColor.r},${block.fontColor.g},${block.fontColor.b})`,
                          textAlign: block.justify,
                          fontFamily: block.fontStyle.includes('cursive') ? 'cursive' : 'serif',
                          fontSize: block.fontStyle.includes('big') ? 28 : 16,
                          textShadow: block.shadow ? '1px 1px 0 #000' : undefined,
                          minHeight: 24,
                        }}
                      />
                    </div>
                  );
                }
                if (block.kind === 'image') {
                  const src = block.image && root ? mediaSrc(root, block.image) : '';
                  return (
                    <div
                      key={`i-${index}`}
                      onMouseDown={(e) => startDrag(index, e, block)}
                      onClick={() => setSelected(index)}
                      className="absolute select-none"
                      style={{
                        left: block.x,
                        top: block.y,
                        outline: selected === index ? '1px dashed rgba(255,255,255,0.8)' : undefined,
                        cursor: 'move',
                        minWidth: 24,
                        minHeight: 24,
                      }}
                    >
                      {src ? <img alt="" src={src} className="max-w-none pointer-events-none" /> : (
                        <div className="flex h-12 w-12 items-center justify-center border border-dashed border-white/70 text-[10px] text-white">
                          {block.imageIcon ? `icon ${block.imageIcon}` : 'image'}
                        </div>
                      )}
                    </div>
                  );
                }
                if (block.kind === 'button') {
                  const src = block.image && root ? mediaSrc(root, block.image) : '';
                  return (
                    <div
                      key={`b-${index}`}
                      onMouseDown={(e) => startDrag(index, e, block)}
                      onClick={() => setSelected(index)}
                      className="absolute select-none"
                      style={{
                        left: block.x,
                        top: block.y,
                        outline: selected === index ? '1px dashed rgba(255,255,255,0.8)' : undefined,
                        cursor: 'move',
                      }}
                    >
                      {src ? (
                        <div className="relative">
                          <img alt="" src={src} className="max-w-none pointer-events-none" />
                          {block.text ? <span className="absolute inset-0 flex items-center justify-center text-xs">{block.text}</span> : null}
                        </div>
                      ) : (
                        <div className="min-w-[72px] rounded-sm border border-border bg-background/80 px-2 py-1 text-center text-xs">{block.text || 'Button'}</div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border p-3 space-y-3">
          <FieldHint hint="Page header keys from MenuBook. pos is x,y,width,height. align is relative to the screen. close is the close-button position, which you can also drag on the page. soundfx_open and soundfx_close are optional. There is no title key; the book is identified by its filename. enabled is a shared menu key Flare does not use for books, so it is left as-is if present. Empty keys are not written. INCLUDE files keep missing header keys until you set them.">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Page</div>
          </FieldHint>
          <Field label="pos" hint="Menu position and size as x,y,width,height in pixels.">
            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <Input
                key={key}
                aria-label={`pos ${key}`}
                width="num"
                className="h-7 text-xs"
                value={book.pos[key]}
                onChange={(event) => touchHeader({ pos: { ...book.pos, [key]: Number(event.target.value) || 0 } }, 'pos')}
              />
            ))}
          </Field>
          <Field label="align" hint="Position relative to the screen edges, such as center or bottom.">
            <Select value={book.align || 'center'} onValueChange={(value) => touchHeader({ align: value }, 'align')}>
              <SelectTrigger width="name" className="h-7 text-xs" aria-label="align"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOK_ALIGNMENTS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="background" hint="Background image for the book page.">
            <Input aria-label="background" width="path" className="h-7 text-xs" value={book.background} onChange={(event) => touchHeader({ background: event.target.value }, 'background')} />
          </Field>
          <Field label="close" hint="Position of the close button as x,y. Drag the × on the page to move it.">
            <Input aria-label="close x" width="num" className="h-7 text-xs" value={book.close?.x ?? ''} onChange={(event) => touchHeader({ close: { x: Number(event.target.value) || 0, y: book.close?.y ?? 0 } }, 'close')} />
            <Input aria-label="close y" width="num" className="h-7 text-xs" value={book.close?.y ?? ''} onChange={(event) => touchHeader({ close: { x: book.close?.x ?? 0, y: Number(event.target.value) || 0 } }, 'close')} />
          </Field>
          <Field label="soundfx_open" hint="Sound played when the book opens.">
            <Input aria-label="soundfx_open" width="path" className="h-7 text-xs" value={book.soundfxOpen ?? ''} onChange={(event) => touchHeader({ soundfxOpen: event.target.value }, 'soundfxOpen')} />
          </Field>
          <Field label="soundfx_close" hint="Sound played when the book closes.">
            <Input aria-label="soundfx_close" width="path" className="h-7 text-xs" value={book.soundfxClose ?? ''} onChange={(event) => touchHeader({ soundfxClose: event.target.value }, 'soundfxClose')} />
          </Field>

          {book.blocks.some((block) => block.kind === 'event') ? (
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Events</div>
              {book.blocks.map((block, index) => block.kind === 'event' ? (
                <Button
                  key={block.section}
                  type="button"
                  size="sm"
                  variant={selected === index ? 'default' : 'outline'}
                  className={selected === index ? 'h-7 bg-orange-600 text-white hover:bg-orange-600 hover:text-white' : 'h-7'}
                  onClick={() => setSelected(index)}
                >
                  {block.section}
                </Button>
              ) : null)}
            </div>
          ) : null}

          {selectedBlock?.kind === 'text' ? (
            <div className="space-y-2">
              <FieldHint hint="[text] block. text_pos is x,y,width,justify. text_font is r,g,b and a font id from font_settings.txt. text_shadow adds a black shadow. requires_status and requires_not_status hide the text unless campaign statuses match.">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Text</div>
              </FieldHint>
              <Field label="text_pos" hint="X, Y, width, and justify (left, center, or right). Drag the orange handle to move the block.">
                <Input aria-label="text x" width="num" className="h-7 text-xs" value={selectedBlock.x} onChange={(event) => updateBlock(selected!, { ...selectedBlock, x: Number(event.target.value) || 0 })} />
                <Input aria-label="text y" width="num" className="h-7 text-xs" value={selectedBlock.y} onChange={(event) => updateBlock(selected!, { ...selectedBlock, y: Number(event.target.value) || 0 })} />
                <Input aria-label="text width" width="num" className="h-7 text-xs" value={selectedBlock.width} onChange={(event) => updateBlock(selected!, { ...selectedBlock, width: Number(event.target.value) || 0 })} />
                <Select value={selectedBlock.justify} onValueChange={(value) => updateBlock(selected!, { ...selectedBlock, justify: value as BookJustify })}>
                  <SelectTrigger width="short" className="h-7 text-xs" aria-label="text justify"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['left', 'center', 'right'] as const).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="text_font" hint="Font color as r,g,b and a font id such as font_regular or font_cursive.">
                <FlareColorField
                  aria-label="text color"
                  value={`${selectedBlock.fontColor.r},${selectedBlock.fontColor.g},${selectedBlock.fontColor.b}`}
                  onChange={(value) => {
                    const [r, g, b] = value.split(',').map((part) => Number(part.trim()) || 0);
                    updateBlock(selected!, { ...selectedBlock, fontColor: { r, g, b } });
                  }}
                />
                <Input aria-label="font style" width="id" className="h-7 text-xs" value={selectedBlock.fontStyle} onChange={(event) => updateBlock(selected!, { ...selectedBlock, fontStyle: event.target.value })} />
              </Field>
              <Field label="text_shadow" hint="If on, the text has a black shadow like other menu labels.">
                <Checkbox checked={Boolean(selectedBlock.shadow)} onCheckedChange={(value) => updateBlock(selected!, { ...selectedBlock, shadow: value === true })} />
              </Field>
              <Field label="requires_status" hint="Campaign statuses required for this text to be visible.">
                <Input aria-label="requires_status" width="name" className="h-7 text-xs" value={selectedBlock.requiresStatus ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, requiresStatus: event.target.value || undefined })} />
              </Field>
              <Field label="requires_not_status" hint="Campaign statuses that hide this text when set.">
                <Input aria-label="requires_not_status" width="name" className="h-7 text-xs" value={selectedBlock.requiresNotStatus ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, requiresNotStatus: event.target.value || undefined })} />
              </Field>
            </div>
          ) : null}

          {selectedBlock?.kind === 'image' ? (
            <div className="space-y-2">
              <FieldHint hint="[image] block. Use image for a filename, or image_icon for an icon id from icons.txt. requires_status and requires_not_status control visibility.">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Image</div>
              </FieldHint>
              <Field label="image_pos" hint="X and Y position of the image. Drag the image on the page to move it.">
                <Input aria-label="image x" width="num" className="h-7 text-xs" value={selectedBlock.x} onChange={(event) => updateBlock(selected!, { ...selectedBlock, x: Number(event.target.value) || 0 })} />
                <Input aria-label="image y" width="num" className="h-7 text-xs" value={selectedBlock.y} onChange={(event) => updateBlock(selected!, { ...selectedBlock, y: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="image" hint="Image filename. Leave empty if you use image_icon instead.">
                <Input aria-label="image" width="path" className="h-7 text-xs" value={selectedBlock.image} onChange={(event) => updateBlock(selected!, { ...selectedBlock, image: event.target.value })} />
              </Field>
              <Field label="image_icon" hint="Icon id from engine/icons.txt, used instead of an image file.">
                <Input aria-label="image_icon" width="num" className="h-7 text-xs" value={selectedBlock.imageIcon ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, imageIcon: event.target.value || undefined })} />
              </Field>
              <Field label="requires_status" hint="Campaign statuses required for this image to be visible.">
                <Input aria-label="requires_status" width="name" className="h-7 text-xs" value={selectedBlock.requiresStatus ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, requiresStatus: event.target.value || undefined })} />
              </Field>
              <Field label="requires_not_status" hint="Campaign statuses that hide this image when set.">
                <Input aria-label="requires_not_status" width="name" className="h-7 text-xs" value={selectedBlock.requiresNotStatus ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, requiresNotStatus: event.target.value || undefined })} />
              </Field>
            </div>
          ) : null}

          {selectedBlock?.kind === 'button' ? (
            <div className="space-y-2">
              <FieldHint hint="[button] block. button_pos is x,y. button_image is optional; the default menu button is used if it is empty. text is an optional label. Other keys are event components run when the button is clicked, including script, book, cutscene, requires_status, set_status and the rest of EventManager. Unlike text and image, requires_status here is an event condition, not a visibility flag.">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Button</div>
              </FieldHint>
              <Field label="button_pos" hint="X and Y position of the button. Drag the button on the page to move it.">
                <Input aria-label="button x" width="num" className="h-7 text-xs" value={selectedBlock.x} onChange={(event) => updateBlock(selected!, { ...selectedBlock, x: Number(event.target.value) || 0 })} />
                <Input aria-label="button y" width="num" className="h-7 text-xs" value={selectedBlock.y} onChange={(event) => updateBlock(selected!, { ...selectedBlock, y: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="button_image" hint="Image file for the button. Leave empty to use the default menu button. Left and right arrow images with a book= action become page-turn buttons.">
                <Input aria-label="button_image" width="path" className="h-7 text-xs" value={selectedBlock.image ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, image: event.target.value || undefined })} />
              </Field>
              <Field label="text" hint="Optional text label on the button.">
                <Input aria-label="button text" width="name" className="h-7 text-xs" value={selectedBlock.text ?? ''} onChange={(event) => updateBlock(selected!, { ...selectedBlock, text: event.target.value || undefined })} />
              </Field>
              <div className="text-xs font-medium">Event components</div>
              <EventComponentsEditor
                components={selectedBlock.components}
                onChange={(components) => updateBlock(selected!, { ...selectedBlock, components })}
                scripts={scripts}
                books={books}
                cutscenes={cutscenes}
              />
            </div>
          ) : null}

          {selectedBlock?.kind === 'event' ? (
            <div className="space-y-2">
              <FieldHint hint={`${selectedBlock.section} runs EventManager components when the book is ${selectedBlock.section === 'event_open' ? 'opened' : 'closed'}. Typical use is script=. Empty values are not written. Flare only uses the first ${selectedBlock.section} section.`}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{selectedBlock.section}</div>
              </FieldHint>
              <EventComponentsEditor
                components={selectedBlock.components}
                onChange={(components) => updateBlock(selected!, { ...selectedBlock, components })}
                scripts={scripts}
                books={books}
                cutscenes={cutscenes}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BookEditorView;
