import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HintLabel } from '@/components/ui/field-hint';
import { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';
import { normalizeEventScriptPath } from '@/editor/eventScripts';

type Props = {
  script: string;
  onScriptChange: (script: string) => void;
  onEditScript?: (path: string) => void;
};

/** The event's action file: path field plus the "Edit actions" shortcut. */
export default function EventActionsSection({ script, onScriptChange, onEditScript }: Props) {
  const editable = normalizeEventScriptPath(script);
  return (
    <div className="space-y-2 px-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-16 shrink-0" hint="What this event does when it runs.">Actions</HintLabel>
        <Input
          width="path"
          className="h-7 text-xs"
          aria-label="Event actions"
          list={EVENT_SCRIPT_LIST_ID}
          placeholder="Choose event actions"
          value={script}
          onChange={(event) => onScriptChange(event.target.value)}
        />
        {editable ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditScript?.(editable)}>
            Edit actions
          </Button>
        ) : null}
      </div>
    </div>
  );
}
