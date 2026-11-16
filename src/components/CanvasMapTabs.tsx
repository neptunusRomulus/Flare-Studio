import { Button } from '@/components/ui/button';
import { ToggleGroup } from '@/components/ui/toggle-group';
import Tooltip from '@/components/ui/tooltip';
import TabItem from '@/components/editor/TabItem';
import { Plus } from 'lucide-react';

type TabEntry = {
  id: string;
  name: string;
  tabType?: 'map' | 'enemy';
};

type Props = {
  tabs: TabEntry[];
  activeTabId: string | null;
  onSwitchTab: (tabId: string) => void;
  onOpenMapSettings: () => void;
  onCloseTab: (tabId: string) => void;
  onCreateNewMap: () => void;
};

/** Orange map-tab strip, flush under the mapCanvas inner stroke. Square top, rounded bottom. */
export default function CanvasMapTabs({
  tabs = [],
  activeTabId,
  onSwitchTab,
  onOpenMapSettings,
  onCloseTab,
  onCreateNewMap,
}: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="pointer-events-none absolute top-px left-1/2 z-20 flex -translate-x-1/2 justify-center">
      <div className="pointer-events-auto flex h-8 max-w-[min(100%,42rem)] items-center gap-0.5 rounded-none rounded-b-lg bg-orange-600 px-1.5 pb-0.5 shadow-sm">
        <ToggleGroup
          type="single"
          value={activeTabId ?? ''}
          onValueChange={(id) => { if (id) onSwitchTab(id); }}
          size="sm"
          className="min-w-0 justify-start gap-0.5 overflow-x-auto no-drag"
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              activeTabId={activeTabId}
              onOpenMapSettings={onOpenMapSettings}
              onCloseEnemyTab={onCloseTab}
            />
          ))}
        </ToggleGroup>
        <Tooltip content="Create a new map" side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCreateNewMap}
            className="h-6 w-6 shrink-0 rounded-md p-0 text-orange-50 hover:bg-orange-500 hover:text-white no-drag"
            aria-label="Create new map"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
