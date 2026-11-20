import { useAppContext } from '@/context/AppContext';
import StatsEditorView from '@/components/StatsEditorView';

/** Right-rail Stats card. */
export default function SidebarStatsArea() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  return <StatsEditorView projectPath={projectPath} />;
}
