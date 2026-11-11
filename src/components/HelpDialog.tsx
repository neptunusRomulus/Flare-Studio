import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import {
  ArrowRight, BookOpen, Calendar, ExternalLink, Flag, Keyboard, Map, MessageCircle, Package,
  Play, ScrollText, Search, Skull, Sparkles, Type, Users, Waypoints, X, Zap,
} from 'lucide-react';
import {
  HELP_LINKS, filterHelpShortcuts, filterHelpTopics, type HelpTarget,
} from '@/help/helpTopics';

const TOPIC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  map: Map,
  npcs: Users,
  dialogue: MessageCircle,
  quests: ScrollText,
  'quest-map': Waypoints,
  moments: Sparkles,
  enemies: Skull,
  items: Package,
  events: Calendar,
  statuses: Flag,
  display: Type,
  export: Play,
};

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Open/focus that area of the app. */
  onGo?: (target: HelpTarget) => void;
  /** Whether a target is reachable right now (e.g. the layer exists). */
  canGo?: (target: HelpTarget) => boolean;
};

function openLink(url: string) {
  const api = window.electronAPI;
  if (api?.openExternal) void api.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">{children}</kbd>
);

const HelpDialog = ({ open, onClose, onGo, canGo }: HelpDialogProps) => {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const topics = useMemo(() => filterHelpTopics(query), [query]);
  const shortcuts = useMemo(() => filterHelpShortcuts(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-label="Help">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-[min(760px,92vh)] w-[min(920px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <BookOpen className="h-4 w-4 text-orange-500" />
          <h3 className="text-base font-semibold">Help</h3>
          <div className="relative ml-auto w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help…"
              aria-label="Search help"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Close Help">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {topics.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => {
                const Icon = TOPIC_ICON[topic.id] ?? Zap;
                const target = topic.target;
                const reachable = !!target && !!onGo && (canGo ? canGo(target) : true);
                return (
                  <div key={topic.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-orange-500" />
                      <span className="flex-1 truncate text-sm font-semibold">{topic.title}</span>
                      {target && (
                        <Tooltip content={reachable ? (topic.where ?? topic.title) : 'Open a project first'}>
                          <span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-my-1 -mr-1.5 h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                              disabled={!reachable}
                              onClick={() => onGo?.(target)}
                            >
                              Go there <ArrowRight className="h-3 w-3" />
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{topic.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {shortcuts.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Keyboard className="h-3.5 w-3.5" /> Shortcuts
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topics.length === 0 && shortcuts.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing found. Try the Flare wiki below.</p>
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-border px-4 py-2">
          <span className="mr-1 text-xs text-muted-foreground">More about Flare:</span>
          {HELP_LINKS.map((link) => (
            <Button key={link.url} variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => openLink(link.url)}>
              {link.label} <ExternalLink className="h-3 w-3" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpDialog;
