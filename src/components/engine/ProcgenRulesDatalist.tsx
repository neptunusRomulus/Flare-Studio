import { useEffect, useState } from 'react';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { PROCGEN_RULES_DIR, PROCGEN_RULES_LIST_ID } from '@/editor/procgenRules';

/** App-wide <datalist> for event procgen_filename fields. */
export default function ProcgenRulesDatalist({ projectPath }: { projectPath: string | null | undefined }) {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    const root = (projectPath || '').replace(/\\/g, '/');
    if (!root) { setPaths([]); return; }
    let alive = true;
    const load = async () => {
      const list = await listTxtUnder(root, PROCGEN_RULES_DIR);
      if (alive) setPaths(list);
    };
    void load();
    window.addEventListener('focus', load);
    return () => { alive = false; window.removeEventListener('focus', load); };
  }, [projectPath]);
  return (
    <datalist id={PROCGEN_RULES_LIST_ID}>
      {paths.map((path) => <option key={path} value={path} />)}
    </datalist>
  );
}
