import { useEffect, useState } from 'react';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { ITEM_RANDOM_DIR, RANDOMIZER_DEF_LIST_ID } from '@/editor/itemRandomizer';

/** App-wide <datalist> for item randomizer_def fields. */
export default function ItemRandomizerDatalist({ projectPath }: { projectPath: string | null | undefined }) {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    const root = (projectPath || '').replace(/\\/g, '/');
    if (!root) { setPaths([]); return; }
    let alive = true;
    const load = async () => {
      const list = await listTxtUnder(root, ITEM_RANDOM_DIR);
      if (alive) setPaths(list);
    };
    void load();
    window.addEventListener('focus', load);
    return () => { alive = false; window.removeEventListener('focus', load); };
  }, [projectPath]);
  return (
    <datalist id={RANDOMIZER_DEF_LIST_ID}>
      {paths.map((path) => <option key={path} value={path} />)}
    </datalist>
  );
}
