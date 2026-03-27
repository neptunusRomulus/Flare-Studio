import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { ChevronsUpDown, Folder, Plus, Sword } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS } from '@/editor/itemRoles';
import type { ItemRole, ItemResourceSubtype } from '@/editor/itemRoles';

type ItemEntry = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

type SidebarItemsPanelProps = {
  itemsList: ItemEntry[];
  expandedItemCategories: Set<ItemRole>;
  setExpandedItemCategories: React.Dispatch<React.SetStateAction<Set<ItemRole>>>;
  onOpenItemEdit: (item: ItemEntry) => void;
  onAddItem: () => void;
};

const SidebarItemsPanel = ({
  itemsList,
  expandedItemCategories,
  setExpandedItemCategories,
  onOpenItemEdit,
  onAddItem
}: SidebarItemsPanelProps) => (
  <div className="flex flex-col flex-1">
    <div className="flex-1 min-h-0 border border-dashed border-border rounded-md overflow-y-auto">
      {itemsList.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
          Click &quot;+ Item&quot; to create a new item definition file.
        </div>
      ) : (
        <div className="flex flex-col gap-1 p-2">
          {(() => {
            const roleOrder = ITEM_ROLE_SELECTIONS.map(r => r.id).concat('unspecified' as ItemRole);
            const roleMetaLookup = ITEM_ROLE_SELECTIONS.reduce(
              (acc, r) => ({ ...acc, [r.id]: ITEM_ROLE_META[r.id] }),
              {} as Record<ItemRole, { label: string; badgeClass: string }>
            );

            return roleOrder.map((roleId) => {
              const items = itemsList.filter((item) => item.role === roleId);
              if (items.length === 0) return null;
              const meta = roleMetaLookup[roleId] || ITEM_ROLE_META.unspecified;
              const isExpanded = expandedItemCategories.has(roleId) || (roleId === 'equipment' && expandedItemCategories.size === 0);
              return (
                <div key={roleId} className="flex flex-col w-full">
                  <Tooltip content="Click to expand" side="right">
                    <div
                      className="flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 rounded-md border border-border cursor-pointer transition-colors w-full"
                      onClick={() => {
                        setExpandedItemCategories(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(roleId)) {
                            newSet.delete(roleId);
                          } else {
                            newSet.add(roleId);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="flex items-center gap-2 flex-1 text-sm font-medium truncate">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                      <ChevronsUpDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </Tooltip>
                  <div
                    className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-1 mt-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border cursor-pointer transition-colors w-full"
                            title={`${item.name} (ID: ${item.id}) - Click to edit`}
                            onClick={() => onOpenItemEdit(item)}
                          >
                            <Sword className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                ID: {item.id}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
    <div className="flex justify-center py-2">
      <Tooltip content="Add Item" side="bottom">
        <Button
          variant="default"
          size="sm"
          aria-label="Add Item"
          className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            console.log('[UI] Add Item button clicked');
            onAddItem();
          }}
        >
          <Plus className="w-3 h-3" />
          Item
        </Button>
      </Tooltip>
    </div>
  </div>
);

export default SidebarItemsPanel;
