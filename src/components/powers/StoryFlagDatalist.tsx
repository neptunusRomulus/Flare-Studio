import { useEffect, useState } from 'react';
import { buildPowerProject } from '@/editor/powers/powerProject';
import { loadTextFiles } from '@/editor/powers/powerFiles';
import { flagSuggestions, STORY_FLAG_DIRS, STORY_FLAG_LIST_ID, type FlagSuggestion } from '@/editor/powers/storyFlags';

/** Ask the shared Story Flag list to re-read the project (after a save, for example). */
export const refreshStoryFlags = () => window.dispatchEvent(new Event('flare-studio:story-flags'));

/**
 * One <datalist> for the whole app: any status field adds list="story-flag-suggestions"
 * and gets the project's existing flags as suggestions. Re-reads on window focus.
 */
const StoryFlagDatalist = ({ projectPath }: { projectPath: string | null | undefined }) => {
  const [items, setItems] = useState<FlagSuggestion[]>([]);
  useEffect(() => {
    if (!projectPath) { setItems([]); return; }
    let alive = true;
    const api = (window as unknown as { electronAPI?: Parameters<typeof loadTextFiles>[0] }).electronAPI || {};
    const load = async () => {
      const files = await loadTextFiles(api, projectPath, STORY_FLAG_DIRS, ['engine/classes.txt']);
      if (alive) setItems(flagSuggestions(buildPowerProject(files).flags));
    };
    void load();
    window.addEventListener('focus', load);
    window.addEventListener('flare-studio:story-flags', load);
    return () => { alive = false; window.removeEventListener('focus', load); window.removeEventListener('flare-studio:story-flags', load); };
  }, [projectPath]);
  return (
    <datalist id={STORY_FLAG_LIST_ID}>
      {items.map((item) => <option key={item.value} value={item.value} label={item.label} />)}
    </datalist>
  );
};

export default StoryFlagDatalist;
