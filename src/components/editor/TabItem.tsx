import { Button } from '@/components/ui/button';
import { ToggleGroupItem } from '@/components/ui/toggle-group';
import Tooltip from '@/components/ui/tooltip';
import { Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabEntry = { id: string; name: string; tabType?: 'map' | 'enemy' };

type Props = {
  tab: TabEntry;
  activeTabId: string | null;
  onOpenMapSettings: () => void;
  onCloseEnemyTab: (tabId: string) => void;
};

export default function TabItem({ tab, activeTabId, onOpenMapSettings, onCloseEnemyTab }: Props) {
  const active = tab.id === activeTabId;
  return (
    <div className="flex min-w-0 items-center">
      <ToggleGroupItem
        value={tab.id}
        size="sm"
        title={tab.name}
        aria-label={tab.name}
        className={cn(
          'h-6 max-w-[10rem] shrink gap-1 rounded-md px-2 text-xs font-medium shadow-none no-drag',
          'bg-transparent text-orange-50 hover:bg-orange-500 hover:text-white',
          'data-[state=on]:bg-orange-800 data-[state=on]:text-white data-[state=on]:hover:bg-orange-800 data-[state=on]:hover:text-white',
          'focus-visible:ring-orange-300 focus-visible:ring-offset-0 dark:focus-visible:ring-orange-200',
        )}
      >
        <span className="truncate">{tab.name}</span>
      </ToggleGroupItem>
      {active && tab.tabType !== 'enemy' && (
        <Tooltip content="Edit Map Settings" side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => { event.stopPropagation(); onOpenMapSettings(); }}
            className="h-5 w-5 shrink-0 rounded-md p-0 text-orange-50 hover:bg-orange-500 hover:text-white"
            aria-label="Edit Map Settings"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </Tooltip>
      )}
      {tab.tabType === 'enemy' && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => { event.stopPropagation(); onCloseEnemyTab(tab.id); }}
          className="h-5 w-5 shrink-0 rounded-md p-0 text-orange-50 hover:bg-orange-500 hover:text-white"
          aria-label="Close enemy tab"
          title="Close"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
