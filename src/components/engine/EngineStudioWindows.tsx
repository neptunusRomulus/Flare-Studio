import { useEffect, useState } from 'react';
import StudioWindow from '@/components/studio/StudioWindow';
import { EngineConfigEditor } from '@/components/EngineConfigEditor';
import PowerTreeEditor from '@/components/engine/PowerTreeEditor';
import ItemMetaEditor from '@/components/engine/ItemMetaEditor';
import ProblemsPanel from '@/components/engine/ProblemsPanel';
import { closeEngineStudio, subscribeEngineStudio, type EngineStudioRequest } from '@/components/studio/engineStudio';

const TITLES: Record<NonNullable<EngineStudioRequest>['view'], string> = {
  files: 'Engine files',
  tree: 'Power tree',
  items: 'Item types, qualities and sets',
  problems: 'Problems',
};

/** Host for engine-file, power-tree, item-meta and Problems windows. Mount once in AppMain. */
export default function EngineStudioWindows() {
  const [req, setReq] = useState<EngineStudioRequest | null>(null);
  useEffect(() => subscribeEngineStudio(setReq), []);
  if (!req) return null;
  return (
    <StudioWindow id={`engine-studio-${req.view}`} title={TITLES[req.view]} onClose={closeEngineStudio}>
      {req.view === 'files' && <EngineConfigEditor initialFile={req.file} />}
      {req.view === 'tree' && <PowerTreeEditor />}
      {req.view === 'items' && <ItemMetaEditor initialFile={req.file} />}
      {req.view === 'problems' && <ProblemsPanel />}
    </StudioWindow>
  );
}
