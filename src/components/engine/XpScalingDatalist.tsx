import { useEffect, useState } from 'react';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { XP_SCALING_DIR, XP_SCALING_LIST_ID } from '@/editor/xpScaling';

/** App-wide <datalist> for enemy xp_scaling= fields. */
export default function XpScalingDatalist({ projectPath }: { projectPath: string | null | undefined }) {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    const root = (projectPath || '').replace(/\\/g, '/');
    if (!root) { setPaths([]); return; }
    let alive = true;
    const load = async () => {
      const list = await listTxtUnder(root, XP_SCALING_DIR);
      if (alive) setPaths(list);
    };
    void load();
    window.addEventListener('focus', load);
    return () => { alive = false; window.removeEventListener('focus', load); };
  }, [projectPath]);
  return (
    <datalist id={XP_SCALING_LIST_ID}>
      {paths.map((path) => <option key={path} value={path} />)}
    </datalist>
  );
}
