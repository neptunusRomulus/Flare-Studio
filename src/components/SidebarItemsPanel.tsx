import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Apple, Book, ChevronsUpDown, Folder, Key, Layers, Plus, Sword } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS } from '@/editor/itemRoles';
import type { ItemRole, ItemResourceSubtype } from '@/editor/itemRoles';
import ElementContextMenu from '@/components/ElementContextMenu';
import ListItemTooltip from '@/components/ListItemTooltip';

type ItemEntry = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

const CategoryIcon = ({ roleId, className }: { roleId: ItemRole; className?: string }) => {
  switch (roleId) {
    case 'equipment': return <Sword className={className} />;
    case 'consumable': return <Apple className={className} />;
    case 'quest': return <Key className={className} />;
    case 'resource': return <Layers className={className} />;
    case 'book': return <Book className={className} />;
    default: return <Folder className={className} />;
  }
};

const getCategoryColor = (roleId: ItemRole) => {
  switch (roleId) {
    case 'equipment': return 'text-orange-500';
    case 'consumable': return 'text-emerald-500 text-emerald-600 dark:text-emerald-400';
    case 'quest': return 'text-amber-500 text-amber-600 dark:text-amber-400';
    case 'resource': return 'text-purple-500 text-purple-600 dark:text-purple-400';
    case 'book': return 'text-blue-500 text-blue-600 dark:text-blue-400';
    default: return 'text-muted-foreground';
  }
};

const getCategoryHeaderStyles = (roleId: ItemRole) => {
  switch (roleId) {
    case 'equipment': return 'text-orange-500/80 hover:bg-orange-500/10';
    case 'consumable': return 'text-emerald-500/80 dark:text-emerald-400/80 hover:bg-emerald-500/10';
    case 'quest': return 'text-amber-500/80 dark:text-amber-400/80 hover:bg-amber-500/10';
    case 'resource': return 'text-purple-500/80 dark:text-purple-400/80 hover:bg-purple-500/10';
    case 'book': return 'text-blue-500/80 dark:text-blue-400/80 hover:bg-blue-500/10';
    default: return 'text-muted-foreground hover:bg-muted/30';
  }
};

type SidebarItemsPanelProps = {
  itemsList: ItemEntry[];
  expandedItemCategories: Set<ItemRole>;
  setExpandedItemCategories: React.Dispatch<React.SetStateAction<Set<ItemRole>>>;
  onOpenItemEdit: (item: ItemEntry) => void;
  onDuplicateItem: (item: ItemEntry) => void;
  onDeleteItem: (item: ItemEntry) => void;
  onAddItem: () => void;
};

const SidebarItemsPanel = ({
  itemsList,
  expandedItemCategories,
  setExpandedItemCategories,
  onOpenItemEdit,
  onDuplicateItem,
  onDeleteItem,
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
                      className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors w-full ${getCategoryHeaderStyles(roleId)}`}
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
                      <CategoryIcon roleId={roleId} className={`w-3.5 h-3.5 flex-shrink-0 ${getCategoryColor(roleId)}`} />
                      <span className="flex-1 text-xs font-medium truncate" style={{ opacity: 0.8 }}>
                        {meta.label}
                      </span>
                      <span className="text-[10px]" style={{ opacity: 0.5 }}>({items.length})</span>
                      <ChevronsUpDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ opacity: 0.4 }} />
                    </div>
                  </Tooltip>
                  <div
                    className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-1 mt-1">
                        {items.map((item) => (
                          <ElementContextMenu
                            key={item.id}
                            elementType="item"
                            onEdit={() => onOpenItemEdit(item)}
                            onDuplicate={() => onDuplicateItem(item)}
                            onDelete={() => onDeleteItem(item)}
                          >
                          <ListItemTooltip>
                          <div
                            className="flex items-center gap-2 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border cursor-pointer transition-colors w-full box-border"
                            onClick={() => onOpenItemEdit(item)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <CategoryIcon roleId={roleId} className={`w-4 h-4 flex-shrink-0 ${getCategoryColor(roleId)}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{item.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  ID: {item.id}
                                </div>
                              </div>
                            </div>
                          </div>
                          </ListItemTooltip>
                          </ElementContextMenu>
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
