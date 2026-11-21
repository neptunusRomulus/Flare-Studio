import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EVENT_COMPONENT_KEYS, type EventScriptComponent } from '@/editor/eventScripts';

/** Repeatable EventManager component rows (script, book, cutscene, set_status, …). */
export default function EventComponentsEditor({
  components,
  onChange,
  scripts,
  books,
  cutscenes,
}: {
  components: EventScriptComponent[];
  onChange: (next: EventScriptComponent[]) => void;
  scripts?: string[];
  books?: string[];
  cutscenes?: string[];
}) {
  const suggestionsFor = (key: string) => {
    if (key === 'script') return scripts || [];
    if (key === 'book') return books || [];
    if (key === 'cutscene') return cutscenes || [];
    return [];
  };
  return (
    <div className="space-y-2">
      {components.map((row, index) => {
        const listId = `event-comp-${index}-${row.key}`;
        const suggestions = suggestionsFor(row.key);
        return (
          <div key={index} className="flex flex-wrap items-center gap-1">
            <Input
              aria-label={`Event key ${index + 1}`}
              width="id"
              className="h-7 text-xs"
              list="event-component-keys"
              value={row.key}
              onChange={(event) => onChange(components.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))}
            />
            <Input
              aria-label={`Event value ${index + 1}`}
              width="path"
              className="h-7 text-xs"
              list={suggestions.length ? listId : undefined}
              value={row.value}
              onChange={(event) => onChange(components.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))}
            />
            {suggestions.length ? (
              <datalist id={listId}>
                {suggestions.map((path) => <option key={path} value={path} />)}
              </datalist>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove event key ${index + 1}`} onClick={() => onChange(components.filter((_, i) => i !== index))}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        );
      })}
      <datalist id="event-component-keys">
        {EVENT_COMPONENT_KEYS.map((key) => <option key={key} value={key} />)}
      </datalist>
      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => onChange([...components, { key: 'set_status', value: '' }])}>
        <Plus className="w-3 h-3 mr-1" />Component
      </Button>
    </div>
  );
}
