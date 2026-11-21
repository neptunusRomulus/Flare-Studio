import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import EventComponentsEditor from '@/components/events/EventComponentsEditor';
import type { EventScriptFile, EventScriptStep } from '@/editor/eventScripts';

/** Editor for a scripts/*.txt queue of [event] steps. */
export default function EventScriptForm({
  file,
  onChange,
  scripts,
  books,
  cutscenes,
}: {
  file: EventScriptFile;
  onChange: (next: EventScriptFile) => void;
  scripts?: string[];
  books?: string[];
  cutscenes?: string[];
}) {
  const setStep = (index: number, next: EventScriptStep) => {
    onChange({ ...file, steps: file.steps.map((step, i) => (i === index ? next : step)) });
  };
  return (
    <div className="space-y-4">
      <FieldHint hint="A script is a queue of [event] sections. Each section runs EventManager components (set_status, reward_*, loot, spawn, msg, cutscene, book, script, and so on). delay is allowed per section. location and activate do not belong here; those are set on each map instance.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What happens</div>
      </FieldHint>
      {file.steps.map((step, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium">Step {index + 1}</div>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove step ${index + 1}`} disabled={file.steps.length <= 1} onClick={() => onChange({ ...file, steps: file.steps.filter((_, i) => i !== index) })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Optional delay before this step runs, as milliseconds or a duration such as 500ms or 1s.">delay</HintLabel>
            <Input aria-label={`Step ${index + 1} delay`} width="short" className="h-7 text-xs" value={step.delay ?? ''} onChange={(event) => setStep(index, { ...step, delay: event.target.value || undefined })} />
          </div>
          <EventComponentsEditor
            components={step.components}
            onChange={(components) => setStep(index, { ...step, components })}
            scripts={scripts}
            books={books}
            cutscenes={cutscenes}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => onChange({ ...file, steps: [...file.steps, { components: [] }] })}>
        <Plus className="w-3 h-3 mr-1" />Step
      </Button>
    </div>
  );
}
