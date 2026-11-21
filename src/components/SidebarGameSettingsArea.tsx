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
      <FieldHint hint="HUD and menu panels (menus/*.txt) are edited on the canvas. Drag a panel to write its pos=; other keys stay as they are.">
        <div className="text-sm font-semibold">UI Settings</div>
      </FieldHint>
      <UIEngineFilesPanel
        general={(
          <>
            <TileSizeForm />
            <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openSettingsLayer('strings')}>Localization</Button>
            <div className="space-y-1">
              <div className="text-xs font-medium">Engine data</div>
              <div className="flex flex-col gap-1">
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('files')}>Engine files</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('tree')}>Power tree</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('items')}>Types, qualities, sets</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('animations')}>Animations</Button>
                <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('problems')}>Problems</Button>
              </div>
            </div>
          </>
        )}
      />
    </div>
  );
}
