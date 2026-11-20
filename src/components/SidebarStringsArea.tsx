import { useAppContext } from '@/context/AppContext';
import StringEditorView from '@/components/StringEditorView';
import { openSettingsLayer } from '@/components/studio/openSettingsLayer';

/** Right-rail Localization card, opened from the UI Settings button. */
export default function SidebarStringsArea() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  return <StringEditorView projectPath={projectPath} onBack={() => openSettingsLayer('gameSettings')} />;
}
