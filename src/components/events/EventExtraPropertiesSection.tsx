import EditorPropertyList from '@/components/EditorPropertyList';
import { newEventExtraRowId, type EventExtraRow } from '@/editor/eventExtraProperties';
import {
  defaultValueForExtraKey,
  extraRowsPalette,
  extraRowsToProperties,
} from '@/components/events/eventExtraPropertiesView';

type Props = {
  rows: EventExtraRow[];
  onRowsChange: (updater: (rows: EventExtraRow[]) => EventExtraRow[]) => void;
};

/** The "More" block: every non-core instance key, editable as rows. */
export default function EventExtraPropertiesSection({ rows, onRowsChange }: Props) {
  return (
    <div className="px-1">
      <EditorPropertyList
        title="More"
        properties={extraRowsToProperties(rows)}
        catalog={extraRowsPalette(rows)}
        onChange={(id, value) => onRowsChange((current) => current.map((row) => (row.id === id ? { ...row, value } : row)))}
        onAdd={(key) => onRowsChange((current) => [...current, { id: newEventExtraRowId(), key, value: defaultValueForExtraKey(key) }])}
        onRemove={(id) => onRowsChange((current) => current.filter((row) => row.id !== id))}
      />
    </div>
  );
}
