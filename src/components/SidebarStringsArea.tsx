import { useAppContext } from '@/context/AppContext';
import StringEditorView from '@/components/StringEditorView';

/** Right-rail Strings card: project language list and translation table. */
export default function SidebarStringsArea() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  return <StringEditorView projectPath={projectPath} />;
}
