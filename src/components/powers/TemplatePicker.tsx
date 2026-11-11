import { KIND_META, POWER_KIND_ORDER, type ContentKind } from '@/editor/powers/powerKinds';
import { POWER_TEMPLATES, EFFECT_TEMPLATES } from '@/editor/powers/powerTemplates';
import { summarizeEffect, summarizePower } from '@/editor/powers/powerSummary';
import Tooltip from '@/components/ui/tooltip';
import { KindIcon } from './kindIcon';

export type TemplateChoice = { kind: ContentKind; templateId: string | null };

const toRecord = (keys: Array<[string, string]>) => {
  const out: Record<string, string[]> = {};
  for (const [k, v] of keys) (out[k] = out[k] || []).push(v);
  return out;
};

const KINDS: ContentKind[] = [...POWER_KIND_ORDER, 'buff', 'debuff'];

/** "New Skill / Monster Attack / …": pick a kind, then a ready template (or blank). */
const TemplatePicker = ({ kind, onKind, onPick }: { kind: ContentKind; onKind: (k: ContentKind) => void; onPick: (c: TemplateChoice) => void }) => {
  const isEffect = kind === 'buff' || kind === 'debuff';
  const cards = isEffect
    ? EFFECT_TEMPLATES.filter((t) => t.kind === kind).map((t) => ({ id: t.id, label: t.label, source: t.source, summary: summarizeEffect(toRecord(t.keys), KIND_META[kind].label) }))
    : POWER_TEMPLATES.filter((t) => t.kind === kind).map((t) => {
      const keys = toRecord(t.keys);
      if (t.effect) keys.post_effect = [`${t.effect.template},${t.effect.magnitude},${t.effect.duration}`];
      const names = Object.fromEntries(EFFECT_TEMPLATES.map((e) => [e.id, e.label]));
      return { id: t.id, label: t.label, source: t.source, summary: summarizePower(keys, names) };
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <Tooltip key={k} content={KIND_META[k].tooltip}>
            <button type="button" onClick={() => onKind(k)}
              className={`h-7 px-2.5 rounded-full text-xs inline-flex items-center gap-1.5 ${kind === k ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>
              <KindIcon kind={k} className="w-3.5 h-3.5" />{KIND_META[k].label}
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <Tooltip key={c.id} content={`From flare-game: ${c.source}`}>
            <button type="button" onClick={() => onPick({ kind, templateId: c.id })}
              className="w-full text-left rounded-lg bg-muted/60 hover:bg-muted p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium"><KindIcon kind={kind} />{c.label}</div>
              <div className="text-[11px] text-muted-foreground leading-snug">{c.summary}</div>
            </button>
          </Tooltip>
        ))}
        <button type="button" onClick={() => onPick({ kind, templateId: null })}
          className="text-left rounded-lg border border-dashed border-border hover:bg-muted/40 p-3 text-sm text-muted-foreground">
          Blank {KIND_META[kind].label}
        </button>
      </div>
    </div>
  );
};

export default TemplatePicker;
