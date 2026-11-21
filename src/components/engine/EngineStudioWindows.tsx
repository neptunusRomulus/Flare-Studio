import { useEffect, useState } from 'react';
import StudioWindow from '@/components/studio/StudioWindow';
import { EngineConfigEditor } from '@/components/EngineConfigEditor';
import PowerTreeEditor from '@/components/engine/PowerTreeEditor';
import ItemMetaEditor from '@/components/engine/ItemMetaEditor';
import AnimationEditor from '@/components/engine/AnimationEditor';
import StatusTrackingView from '@/components/engine/StatusTrackingView';
import ModSettingsForm from '@/components/engine/ModSettingsForm';
import { useAppContext } from '@/context/AppContext';
import ProblemsPanel from '@/components/engine/ProblemsPanel';
import { closeEngineStudio, subscribeEngineStudio, type EngineStudioRequest } from '@/components/studio/engineStudio';

const TITLES: Record<NonNullable<EngineStudioRequest>['view'], string> = {
  files: 'Engine files',
  tree: 'Power tree',
  items: 'Item types, qualities and sets',
  problems: 'Problems',
  animations: 'Animations',
  statuses: 'Status tracking',
  mod: 'Mod settings',
};

/** Host for engine-file, power-tree, item-meta and Problems windows. Mount once in AppMain. */
export default function EngineStudioWindows() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [req, setReq] = useState<EngineStudioRequest | null>(null);
  useEffect(() => subscribeEngineStudio(setReq), []);
  if (!req) return null;
  return (
    <StudioWindow id={`engine-studio-${req.view}`} title={TITLES[req.view]} onClose={closeEngineStudio}>
      {req.view === 'files' && <EngineConfigEditor initialFile={req.file} />}
      {req.view === 'tree' && <PowerTreeEditor />}
      {req.view === 'items' && <ItemMetaEditor initialFile={req.file} />}
      {req.view === 'problems' && <ProblemsPanel />}
      {req.view === 'animations' && <AnimationEditor projectPath={projectPath} initialFile={req.file} />}
      {req.view === 'statuses' && <StatusTrackingView projectPath={projectPath} />}
      {req.view === 'mod' && <ModSettingsForm projectPath={projectPath} />}
    </StudioWindow>
  );
}
