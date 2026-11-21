import { useEffect, useState } from 'react';
import { parseStepSounds, STEP_SOUND_LIST_ID, STEP_SOUNDS_PATH } from '@/editor/avatarSounds';

/** App-wide <datalist> for sfx_step ids from items/step_sounds.txt. */
export default function StepSoundDatalist({ projectPath }: { projectPath: string | null | undefined }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const root = (projectPath || '').replace(/\\/g, '/');
    if (!root || !window.electronAPI?.readFile) { setIds([]); return; }
    let alive = true;
    const load = async () => {
      const text = await window.electronAPI.readFile(`${root}/${STEP_SOUNDS_PATH}`);
      if (alive) setIds(parseStepSounds(text || '').map((set) => set.id).filter(Boolean));
    };
    void load();
    window.addEventListener('focus', load);
    return () => { alive = false; window.removeEventListener('focus', load); };
  }, [projectPath]);
  return (
    <datalist id={STEP_SOUND_LIST_ID}>
      {ids.map((id) => <option key={id} value={id} />)}
    </datalist>
  );
}
