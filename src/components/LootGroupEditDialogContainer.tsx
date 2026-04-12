/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import LootGroupEditDialog from '@/components/LootGroupEditDialog';

type LootGroupEditDialogCtx = {
  showLootGroupEditDialog?: boolean;
  lootGroupEditingItem?: Record<string, unknown> | null;
  lootGroupEditingData?: Record<string, unknown> | null;
  itemsList?: unknown[];
  updateLootGroupField?: (key: string, value: unknown) => void;
  handleCloseLootGroupEdit?: () => void;
  handleSaveLootGroupEdit?: () => void;
};

export default function LootGroupEditDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as LootGroupEditDialogCtx;

  return (
    <LootGroupEditDialog
      open={!!c.showLootGroupEditDialog}
      lootGroupItem={c.lootGroupEditingItem as any ?? null}
      lootGroupData={c.lootGroupEditingData ?? null}
      itemsList={(c.itemsList as any[]) ?? []}
      updateLootGroupField={(k, v) => (c.updateLootGroupField ? c.updateLootGroupField(k, v) : undefined)}
      onClose={c.handleCloseLootGroupEdit ?? (() => {})}
      onSave={c.handleSaveLootGroupEdit ?? (() => {})}
    />
  );
}
