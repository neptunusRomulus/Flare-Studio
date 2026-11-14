import { describe, it, expect } from 'vitest';
import { dialogCtxForContainers } from './DialogsContainer';

describe('dialogCtxForContainers', () => {
  it('copies onDeleteItem from the top-level ctx when dialogsCtx omitted it', () => {
    const onDeleteItem = async () => false;
    const ctx = {
      onDeleteItem,
      dialogsCtx: { showItemEditDialog: true, editingItem: { id: 1 } },
    };
    expect(dialogCtxForContainers(ctx)).toEqual({
      showItemEditDialog: true,
      editingItem: { id: 1 },
      onDeleteItem,
    });
  });

  it('keeps the nested onDeleteItem when it is already present', () => {
    const nested = async () => true;
    const outer = async () => false;
    const ctx = {
      onDeleteItem: outer,
      dialogsCtx: { onDeleteItem: nested, showItemEditDialog: true },
    };
    expect(dialogCtxForContainers(ctx)).toEqual({
      onDeleteItem: nested,
      showItemEditDialog: true,
    });
  });

  it('falls back to the root ctx when there is no dialogsCtx', () => {
    const ctx = { onDeleteItem: async () => false, showItemEditDialog: true };
    expect(dialogCtxForContainers(ctx)).toBe(ctx);
  });
});
