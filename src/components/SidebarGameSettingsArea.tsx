import { Button } from '@/components/ui/button';
import { FieldHint } from '@/components/ui/field-hint';
import { TileSizeForm } from './studio/studioEditors';
import { openEngineStudio } from '@/components/studio/engineStudio';
import { openSettingsLayer } from '@/components/studio/openSettingsLayer';
import UIEngineFilesPanel from '@/components/UIEngineFilesPanel';

/** Right-rail UI Settings card: menu layout lives on the canvas; tile size and Engine Studio entry points are here. */
export default function SidebarGameSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <FieldHint hint="Drag a menu panel on the canvas to move it. Use the Menu editor for its other settings.">
        <div className="text-sm font-semibold">UI Settings</div>
      </FieldHint>
      <UIEngineFilesPanel
        general={(
          <>
            <TileSizeForm />
            <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openSettingsLayer('strings')}>Localization</Button>
            <div className="space-y-1">
              <div className="text-xs font-medium">Game data</div>
              <div className="flex flex-col gap-1">
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('files')}>Game files</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('tree')}>Power tree</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('items')}>Types, qualities, sets</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('animations')}>Animations</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('tileset-animations')}>Tileset animations</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('statuses')}>Status tracking</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('mod')}>Mod settings</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('test-save')}>Test save</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('problems')}>Problems</Button>
              </div>
            </div>
          </>
        )}
      />
    </div>
  );
}
