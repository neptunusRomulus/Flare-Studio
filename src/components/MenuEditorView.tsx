import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import {
  alignToScreenEdge,
  DEFAULT_RESOLUTIONS,
  MAIN_MENU_FILES,
  mergeMenuPos,
  parseMenuText,
  parseResolutionsText,
  posFromScreen,
  viewSize,
  type MenuPanel,
  type Resolutions,
} from '@/editor/menuLayout';

export const OPEN_MENUS_EVENT = 'flare-studio:open-menus';

const RESOLUTIONS = [
  { label: '640×480', w: 640, h: 480 },
  { label: '1280×720', w: 1280, h: 720 },
  { label: '1920×1080', w: 1920, h: 1080 },
];

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

type Props = { projectPath: string | null | undefined };

const MenuEditorView = ({ projectPath }: Props) => {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [screen, setScreen] = useState(RESOLUTIONS[2]);
  const [resolutions, setResolutions] = useState<Resolutions>(DEFAULT_RESOLUTIONS);
  const [panels, setPanels] = useState<MenuPanel[]>([]);
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState<Record<string, MenuPanel>>({});
  const [scale, setScale] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const view = useMemo(() => viewSize(screen.w, screen.h, resolutions), [screen, resolutions]);

  const load = useCallback(async () => {
    if (!root || !window.electronAPI?.readDir || !window.electronAPI?.readFile) return;
    try {
      const resText = await window.electronAPI.readFile(projectFile(root, 'engine/resolutions.txt'));
      if (resText) setResolutions(parseResolutionsText(resText));
    } catch { /* keep defaults */ }
    let names: string[] = [];
    try {
      const entries = await window.electronAPI.readDir(projectFile(root, 'menus')) || [];
      names = entries
        .filter((entry: { isDirectory?: boolean; name: string }) => !entry.isDirectory && entry.name.endsWith('.txt'))
        .map((entry: { name: string }) => entry.name);
    } catch { names = []; }
    if (!names.length) names = [...MAIN_MENU_FILES];
    const loaded: MenuPanel[] = [];
    for (const name of names) {
      try {
        const text = await window.electronAPI.readFile(projectFile(root, `menus/${name}`));
        if (text) loaded.push(parseMenuText(text, `menus/${name}`));
      } catch { /* missing in this mod */ }
    }
    setPanels(loaded);
    setDirty({});
  }, [root]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onOpen = () => { void load(); };
    window.addEventListener(OPEN_MENUS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MENUS_EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const fit = () => {
      const sx = (node.clientWidth - 32) / Math.max(view.viewW, 1);
      const sy = (node.clientHeight - 32) / Math.max(view.viewH, 1);
      setScale(Math.max(0.15, Math.min(1, sx, sy)));
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(node);
    return () => obs.disconnect();
  }, [view.viewW, view.viewH]);

  const current = (file: string) => dirty[file] || panels.find((panel) => panel.file === file);

  const startDrag = (panel: MenuPanel, event: ReactMouseEvent, screenRect: { x: number; y: number }) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(panel.file);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: screenRect.x, y: screenRect.y };
    const onMove = (e: MouseEvent) => {
      const x = Math.round(origin.x + (e.clientX - startX) / scale);
      const y = Math.round(origin.y + (e.clientY - startY) / scale);
      const pos = posFromScreen({ x, y }, { w: panel.pos.w, h: panel.pos.h }, panel.align, view.viewW, view.viewH, resolutions.frameW, resolutions.frameH);
      setDirty((prev) => ({ ...prev, [panel.file]: { ...(current(panel.file) as MenuPanel), pos } }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const save = async () => {
    if (!root || !window.electronAPI?.writeFile) return;
    for (const panel of Object.values(dirty)) {
      const next = mergeMenuPos(panel.text, panel.pos);
      await window.electronAPI.writeFile(projectFile(root, panel.file), next);
    }
    await load();
  };

  if (!root) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Open a project to edit menus.</div>;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-sm font-semibold">Menus</div>
        <div className="flex items-center gap-1 ml-2">
          {RESOLUTIONS.map((entry) => (
            <Button
              key={entry.label}
              type="button"
              size="sm"
              variant={screen.label === entry.label ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setScreen(entry)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground ml-2">
          view {view.viewW}×{view.viewH}
        </div>
        <Tooltip content="Write pos= for moved panels. Other keys stay as they are.">
          <Button type="button" size="sm" className="h-7 ml-auto" disabled={!Object.keys(dirty).length} onClick={() => void save()}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-44 overflow-y-auto border-r border-border p-2 space-y-0.5">
          {panels.map((panel) => (
            <button
              key={panel.file}
              type="button"
              className={`w-full text-left rounded px-2 py-1 text-[11px] ${selected === panel.file ? 'bg-muted' : 'hover:bg-muted/60'}`}
              onClick={() => setSelected(panel.file)}
            >
              {panel.name}
              {dirty[panel.file] ? ' •' : ''}
            </button>
          ))}
          {panels.length === 0 && <p className="text-[11px] text-muted-foreground">No menus/*.txt in this project.</p>}
        </div>
        <div ref={frameRef} className="flex-1 overflow-auto p-4 bg-zinc-900">
          <div style={{ width: view.viewW * scale, height: view.viewH * scale, margin: '0 auto' }}>
            <div
              className="relative bg-zinc-800"
              style={{ width: view.viewW, height: view.viewH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
              {panels.map((base) => {
                const panel = current(base.file) as MenuPanel;
                const rect = alignToScreenEdge(panel.pos, panel.align, view.viewW, view.viewH, resolutions.frameW, resolutions.frameH);
                return (
                  <div
                    key={panel.file}
                    onMouseDown={(e) => startDrag(panel, e, { x: rect.x, y: rect.y })}
                    onClick={() => setSelected(panel.file)}
                    className={`absolute border text-[10px] leading-tight px-1 py-0.5 overflow-hidden cursor-move ${selected === panel.file ? 'border-amber-400 bg-amber-400/20 text-amber-50' : 'border-white/40 bg-black/40 text-white/90'}`}
                    style={{ left: rect.x, top: rect.y, width: Math.max(rect.w, 8), height: Math.max(rect.h, 8) }}
                    title={`${panel.file}  pos=${panel.pos.x},${panel.pos.y}  align=${panel.align}`}
                  >
                    {panel.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuEditorView;
