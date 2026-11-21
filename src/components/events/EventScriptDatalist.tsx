import useEventScripts, { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';

/** App-wide <datalist> for script= fields. Any input can use list={EVENT_SCRIPT_LIST_ID}. */
export default function EventScriptDatalist({ projectPath }: { projectPath: string | null | undefined }) {
  const { scripts } = useEventScripts(projectPath);
  return (
    <datalist id={EVENT_SCRIPT_LIST_ID}>
      {scripts.map((path) => <option key={path} value={path} />)}
    </datalist>
  );
}
