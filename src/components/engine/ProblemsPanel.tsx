import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { loadProjectTextMap } from '@/editor/projectFiles';
import { findProjectProblems, openProjectProblem, type ProjectProblem } from '@/editor/projectProblems';
import { openEngineStudio } from '@/components/studio/engineStudio';

const KIND_LABEL: Record<ProjectProblem['kind'], string> = {
  intermap: 'Map link',
  loot: 'Loot',
  vendor: 'Vendor',
  class: 'Class',
  book: 'Book',
  item: 'Item',
  quest: 'Quest',
};

export default function ProblemsPanel() {
  const ctx = useAppContext() as Record<string, unknown>;
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [problems, setProblems] = useState<ProjectProblem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!projectPath) { setProblems([]); return; }
    setLoading(true);
    try {
      const files = await loadProjectTextMap(projectPath);
      setProblems(findProjectProblems(files));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [projectPath]);

  const open = (problem: ProjectProblem) => {
    if (openProjectProblem(problem)) return;
    if (problem.path.startsWith('engine/')) {
      openEngineStudio('files', problem.path.replace(/^engine\//, ''));
      return;
    }
    if (problem.path.startsWith('powers/trees/')) {
      openEngineStudio('tree');
      return;
    }
    if (/^items\/(types|qualities|sets)\.txt$/.test(problem.path)) {
      openEngineStudio('items', problem.path);
      return;
    }
    if (problem.kind === 'item' || problem.path.startsWith('items/')) {
      const items = Array.isArray(ctx.itemsList) ? ctx.itemsList as Array<{ id: number; name?: string }> : [];
      const id = Number((problem.value.split(',')[0] || '').split(':')[0]);
      const item = items.find((entry) => entry.id === id);
      const openItem = ctx.handleOpenItemEdit as ((item: unknown) => void) | undefined;
      if (item && openItem) { openItem(item); return; }
    }
    if (problem.kind === 'quest' || problem.path.startsWith('quests/')) {
      const id = problem.path.replace(/^quests\//, '').replace(/\.txt$/i, '');
      const openQuest = ctx.handleOpenQuestEditDialog as ((id: string) => void) | undefined;
      if (openQuest) { openQuest(id); return; }
    }
    if (problem.kind === 'intermap' || problem.path.startsWith('maps/')) {
      const file = problem.kind === 'intermap' ? (problem.value.split(',')[0] || '').trim().split('/').pop() : problem.path.split('/').pop();
      const openMap = ctx.openProjectMap as ((name: string) => void) | undefined;
      if (file && openMap) { void openMap(file); return; }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-xs text-muted-foreground">
          {loading ? 'Checking…' : problems.length === 0 ? 'No broken references found.' : `${problems.length} problem${problems.length === 1 ? '' : 's'}`}
        </div>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => void reload()}>Refresh</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {problems.map((problem) => (
          <button
            key={problem.id}
            type="button"
            onClick={() => open(problem)}
            className="w-full text-left px-3 py-2 border-b border-border/40 hover:bg-muted/50 space-y-0.5"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{KIND_LABEL[problem.kind]}</span>
              <span className="truncate">{problem.message}</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{problem.path}:{problem.line} {problem.key}=</div>
          </button>
        ))}
      </div>
    </div>
  );
}
