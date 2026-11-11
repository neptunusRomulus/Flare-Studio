import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, GitBranch, HelpCircle, LayoutGrid, MapPin, Maximize2, Play, Zap, X } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import { npcListThumbPath, resolveNpcPreviewPaths } from '@/flare/npcPreviewPaths';
import {
  MAX_CARD_STEPS,
  bundleEventEdges,
  fitViewport,
  routeEdges,
  layoutQuestGraph,
  primaryKind,
  type QuestMapBox,
  type QuestMapGraph,
  type QuestMapLinkKind,
  type QuestMapNpcCard,
  type QuestMapPositions,
  type QuestMapQuestCard,
} from '@/editor/questMap';

type Props = {
  graph: QuestMapGraph;
  positions: QuestMapPositions;
  onPositionsChange: (next: QuestMapPositions) => void;
  onOpenQuest: (questId: string) => void;
  onOpenNpc: (objectId: number) => void;
  onClose: () => void;
  projectPath?: string | null;
};

const EDGE_STYLE: Record<QuestMapLinkKind, { stroke: string; dash?: string; pill: string }> = {
  starts: { stroke: '#10b981', pill: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  advances: { stroke: '#0ea5e9', pill: 'border-sky-500/40 text-sky-600 dark:text-sky-400' },
  ends: { stroke: '#f59e0b', pill: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  unlocks: { stroke: '#f97316', pill: 'border-orange-500/40 text-orange-600 dark:text-orange-400' },
  mentions: { stroke: '#94a3b8', dash: '5 5', pill: 'border-border text-muted-foreground' },
};

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

function NpcThumb({ portrait, name, projectPath }: { portrait?: string; name: string; projectPath?: string | null }) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!portrait) { setPath(null); return undefined; }
    void resolveNpcPreviewPaths({ portraitPath: portrait, projectPath }).then((preview) => {
      if (!cancelled) setPath(npcListThumbPath(preview));
    }).catch(() => { if (!cancelled) setPath(null); });
    return () => { cancelled = true; };
  }, [portrait, projectPath]);
  if (!path) return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
  return <NpcAssetThumb imagePath={path} alt={name} className="h-full w-full" />;
}

function QuestCardBody({ quest, npcName, eventName }: { quest: QuestMapQuestCard; npcName: (id: string) => string; eventName: (id: string) => string }) {
  const shown = quest.steps.slice(0, MAX_CARD_STEPS);
  const more = quest.steps.length - shown.length;
  const who = (ids: string[], events: string[]) => {
    const names = [...ids.map(npcName), ...events.map(eventName)];
    return names.length ? Array.from(new Set(names)).join(', ') : '—';
  };
  return (
    <>
      <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
        <span className="text-orange-500 shrink-0 flex"><GitBranch className="w-4 h-4" /></span>
        <span className="text-sm font-medium truncate">{quest.name}</span>
      </div>
      <ol className="px-3 py-1.5 text-xs text-muted-foreground">
        {shown.length === 0 && <li className="h-5 leading-5 italic">No steps</li>}
        {shown.map((step, i) => <li key={i} className="h-5 leading-5 truncate">{step}</li>)}
        {more > 0 && <li className="h-5 leading-5">+{more} more</li>}
      </ol>
      <div className="flex items-center gap-3 px-3 h-[30px] border-t border-border text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 min-w-0"><span className="text-emerald-500 shrink-0 flex"><Play className="w-3 h-3" /></span><span className="truncate">{who(quest.starters, quest.starterEvents)}</span></span>
        <span className="flex items-center gap-1 min-w-0"><span className="text-amber-500 shrink-0 flex"><Flag className="w-3 h-3" /></span><span className="truncate">{who(quest.finishers, quest.finisherEvents)}</span></span>
      </div>
    </>
  );
}

function NpcCardBody({ npc, projectPath }: { npc: QuestMapNpcCard; projectPath?: string | null }) {
  return (
    <div className="flex items-center gap-2 px-2 w-full h-full">
      <div className="w-10 h-10 shrink-0 rounded border border-border bg-muted/50 flex items-center justify-center overflow-hidden">
        <NpcThumb portrait={npc.portrait} name={npc.name} projectPath={projectPath} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{npc.name}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{npc.location}</span>
        </div>
      </div>
    </div>
  );
}

/** Read-only canvas of quests and the NPCs linked to them by statuses. */
export default function QuestMapView({ graph: fullGraph, positions, onPositionsChange, onOpenQuest, onOpenNpc, onClose, projectPath }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ x: 40, y: 40, zoom: 1 });
  const [dragging, setDragging] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const edgeFocus = (from: string, to: string) => (!hovered ? 'normal' : hovered === from || hovered === to ? 'on' : 'off');
  const gesture = useRef<{ kind: 'pan' | 'node'; nodeId?: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const graph = useMemo(() => bundleEventEdges(fullGraph), [fullGraph]);
  const layout = useMemo(() => layoutQuestGraph(graph, positions), [graph, positions]);
  const boxes = useMemo(() => {
    const map = new Map<string, QuestMapBox>(layout.map((b) => [b.nodeId, b]));
    if (dragging) {
      const box = map.get(dragging.nodeId);
      if (box) map.set(dragging.nodeId, { ...box, x: dragging.x, y: dragging.y });
    }
    return map;
  }, [layout, dragging]);
  const routes = useMemo(() => routeEdges(graph.edges, boxes), [graph.edges, boxes]);
  const npcByNode = useMemo(() => new Map(graph.npcs.map((n) => [n.nodeId, n])), [graph.npcs]);
  const questByNode = useMemo(() => new Map(graph.quests.map((q) => [q.nodeId, q])), [graph.quests]);
  const npcName = useCallback((id: string) => graph.npcs.find((n) => n.npcId === id)?.name || id, [graph.npcs]);
  const eventName = useCallback((id: string) => graph.events.find((e) => e.eventId === id)?.name || 'Map event', [graph.events]);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !layout.length) return;
    setView(fitViewport(layout, { width: el.clientWidth, height: el.clientHeight }, MIN_ZOOM, 1));
  }, [layout]);

  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !layout.length) return;
    fitted.current = true;
    fit();
  }, [fit, layout.length]);

  // Wheel zooms around the cursor (non-passive so the page does not scroll).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((v) => {
        const zoom = clampZoom(v.zoom * Math.exp(-event.deltaY * 0.0015));
        const k = zoom / v.zoom;
        return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent, nodeId?: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const box = nodeId ? boxes.get(nodeId) : null;
    gesture.current = {
      kind: nodeId ? 'node' : 'pan',
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: box ? box.x : view.x,
      originY: box ? box.y : view.y,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    if (g.kind === 'pan') setView((v) => ({ ...v, x: g.originX + dx, y: g.originY + dy }));
    else if (g.nodeId) setDragging({ nodeId: g.nodeId, x: g.originX + dx / view.zoom, y: g.originY + dy / view.zoom });
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.kind !== 'node' || !g.nodeId) return;
    if (g.moved && dragging) {
      onPositionsChange({ ...positions, [g.nodeId]: { x: Math.round(dragging.x), y: Math.round(dragging.y) } });
      setDragging(null);
      return;
    }
    setDragging(null);
    const quest = questByNode.get(g.nodeId);
    if (quest) { onOpenQuest(quest.questId); return; }
    const npc = npcByNode.get(g.nodeId);
    if (npc?.objectId !== undefined) onOpenNpc(npc.objectId);
  };

  const hasSaved = Object.keys(positions).length > 0;

  return (
    <div className="absolute inset-0 z-20 bg-background flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; setDragging(null); }}
      >
        {graph.quests.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No quests yet</div>
        ) : (
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
            <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width={1} height={1}>
              {graph.edges.map((edge) => {
                const route = routes.get(edge.id);
                if (!route) return null;
                const style = EDGE_STYLE[primaryKind(edge.links)];
                const focus = edgeFocus(edge.from, edge.to);
                return <path key={edge.id} d={route.d} style={{ color: style.stroke, fill: 'none', stroke: style.stroke, strokeWidth: focus === 'on' ? 3 : 2, strokeDasharray: style.dash, opacity: focus === 'off' ? 0.15 : 0.85 }} />;
              })}
            </svg>
            {graph.edges.map((edge) => {
              const route = routes.get(edge.id);
              if (!route || !edge.label) return null;
              const mid = route.label;
              const style = EDGE_STYLE[primaryKind(edge.links)];
              return (
                <div key={`label-${edge.id}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: mid.x, top: mid.y, opacity: edgeFocus(edge.from, edge.to) === 'off' ? 0.2 : 1, zIndex: edgeFocus(edge.from, edge.to) === 'on' ? 5 : undefined }} onPointerDown={(e) => e.stopPropagation()}>
                  <Tooltip content={<span className="whitespace-pre font-mono text-[11px]">{edge.tooltip}</span>}>
                    <span className={`inline-block max-w-[160px] truncate rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium ${style.pill}`}>{edge.label}</span>
                  </Tooltip>
                </div>
              );
            })}
            {graph.quests.map((quest) => {
              const box = boxes.get(quest.nodeId);
              if (!box) return null;
              return (
                <div
                  key={quest.nodeId}
                  className="absolute rounded-lg border border-orange-500/40 bg-card shadow-sm hover:border-orange-500 cursor-pointer overflow-hidden"
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: dragging?.nodeId === box.nodeId ? 10 : undefined }}
                  onPointerDown={(e) => onPointerDown(e, quest.nodeId)}
                  onMouseEnter={() => setHovered(quest.nodeId)}
                  onMouseLeave={() => setHovered((h) => (h === quest.nodeId ? null : h))}
                  title={quest.name}
                >
                  <QuestCardBody quest={quest} npcName={npcName} eventName={eventName} />
                </div>
              );
            })}
            {graph.events.map((event) => {
              const box = boxes.get(event.nodeId);
              if (!box) return null;
              return (
                <div
                  key={event.nodeId}
                  className="absolute rounded-lg border border-dashed border-border bg-card shadow-sm overflow-hidden cursor-move"
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: dragging?.nodeId === box.nodeId ? 10 : undefined }}
                  onPointerDown={(e) => onPointerDown(e, event.nodeId)}
                  onMouseEnter={() => setHovered(event.nodeId)}
                  onMouseLeave={() => setHovered((h) => (h === event.nodeId ? null : h))}
                >
                  <Tooltip
                    content={event.details
                      ? <span className="whitespace-pre text-[11px]">{event.details.join('\n')}</span>
                      : 'Map event. Open its map to edit it'}
                    className="w-full h-full"
                  >
                    <div className="flex items-center gap-2 px-2 w-full h-full">
                      <span className={`relative text-violet-500 shrink-0 flex ${event.count ? 'mr-2' : ''}`}>
                        <Zap className="w-4 h-4" />
                        {event.count ? <span className="absolute -right-2 -top-2 min-w-[16px] h-4 px-1 rounded-full bg-violet-500 text-white text-[9px] leading-4 text-center">{event.count}</span> : null}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{event.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                </div>
              );
            })}
            {graph.npcs.map((npc) => {
              const box = boxes.get(npc.nodeId);
              if (!box) return null;
              const editable = npc.objectId !== undefined;
              const body = <NpcCardBody npc={npc} projectPath={projectPath} />;
              return (
                <div
                  key={npc.nodeId}
                  className={`absolute rounded-lg border bg-card shadow-sm overflow-hidden ${editable ? 'border-blue-500/40 hover:border-blue-500 cursor-pointer' : 'border-border cursor-move'}`}
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: dragging?.nodeId === box.nodeId ? 10 : undefined }}
                  onPointerDown={(e) => onPointerDown(e, npc.nodeId)}
                  onMouseEnter={() => setHovered(npc.nodeId)}
                  onMouseLeave={() => setHovered((h) => (h === npc.nodeId ? null : h))}
                >
                  {editable ? body : <Tooltip content="Open its map to edit this NPC" className="w-full h-full">{body}</Tooltip>}
                </div>
              );
            })}
          </div>
        )}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm" onPointerDown={(e) => e.stopPropagation()}>
          <Tooltip content="Fit to screen" side="bottom">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Fit to screen" onClick={fit}><Maximize2 className="w-4 h-4" /></Button>
          </Tooltip>
          <Tooltip content="Auto arrange (forget moved cards)" side="bottom">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Auto arrange" disabled={!hasSaved} onClick={() => onPositionsChange({})}><LayoutGrid className="w-4 h-4" /></Button>
          </Tooltip>
          <Tooltip content="Back to the map" side="bottom">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Close quest map" onClick={onClose}><X className="w-4 h-4" /></Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
