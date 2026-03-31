import React from 'react';
import SidebarItemsPanel from '@/components/SidebarItemsPanel';
import type { ItemRole, ItemResourceSubtype } from '@/editor/itemRoles';

type ItemSummary = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

type Props = {
  itemsList: ItemSummary[];
  expandedItemCategories: Set<ItemRole>;
  setExpandedItemCategories: React.Dispatch<React.SetStateAction<Set<ItemRole>>>;
  handleOpenItemEdit: (item: ItemSummary) => void;
  handleDuplicateItem: (item: ItemSummary) => void;
  handleDeleteItem: (item: ItemSummary) => void;
  handleOpenItemDialog: () => void;
};

const SidebarItemsArea: React.FC<Props> = ({
  itemsList,
  expandedItemCategories,
  setExpandedItemCategories,
  handleOpenItemEdit,
  handleDuplicateItem,
  handleDeleteItem,
  handleOpenItemDialog
}) => {
  return (
    <SidebarItemsPanel
      itemsList={itemsList}
      expandedItemCategories={expandedItemCategories}
      setExpandedItemCategories={setExpandedItemCategories}
      onOpenItemEdit={handleOpenItemEdit}
      onDuplicateItem={handleDuplicateItem}
      onDeleteItem={handleDeleteItem}
      onAddItem={handleOpenItemDialog}
    />
  );
};

export default SidebarItemsArea;
