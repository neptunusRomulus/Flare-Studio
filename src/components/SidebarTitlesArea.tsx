import { useAppContext } from '@/context/AppContext';
import TitlesEditorView from '@/components/TitlesEditorView';

/** Right-rail Titles card. */
export default function SidebarTitlesArea() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  return <TitlesEditorView projectPath={projectPath} />;
}
