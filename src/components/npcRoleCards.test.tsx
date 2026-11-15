// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapObject } from '@/types';
import { AppProvider } from '@/context/AppContext';
import { NPC_ROLE_META_LOOKUP } from '@/editor/actorRoles';
import NpcEditDialog from './NpcEditDialog';
import NpcRoleCenterDialog from './NpcRoleCenterDialog';

const npc = (properties: Record<string, string>): MapObject => ({
  id: 1,
  name: 'Guard',
  type: 'npc',
  x: 1,
  y: 2,
  width: 1,
  height: 1,
  properties,
});

const editProps = {
  setEditingObject: () => {},
  updateEditingObjectProperty: () => {},
  updateEditingObjectBoolean: () => {},
  getEditingObjectProperty: (key: string, fallback = '') => fallback,
  editor: null,
  canUseTilesetDialog: false,
  handleEditingTilesetBrowse: () => {},
  handleEditingPortraitBrowse: () => {},
  handleAutoDetectAnim: () => {},
  onOpenRoleCenter: () => {},
  itemsList: [],
};

describe('NPC role cards and role windows', () => {
  it('renders on cards with the sidebar role colors and + Add on an off card', () => {
    const { container } = render(
      <NpcEditDialog
        {...editProps}
        editingObject={npc({ talker: 'true' })}
        getEditingObjectProperty={(key, fallback = '') => (key === 'talker' ? 'true' : fallback)}
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain(NPC_ROLE_META_LOOKUP.isTalker.badgeClass);
    expect(html).toContain('+ Add');
    expect(container.textContent).toMatch(/Dialogue/);
    expect(container.textContent).toMatch(/Shop/);
    expect(container.textContent).toMatch(/Quest/);
  });

  it('opens a Shop window with no Dialogue/Quest tabs and exactly one Save', () => {
    const { container } = render(
      <AppProvider value={{ currentProjectPath: null }}>
        <NpcRoleCenterDialog
          tab="vendor"
          onTabChange={() => {}}
          editingObject={npc({ vendor: 'true' })}
          itemsList={[]}
          dialogueTrees={[]}
          setDialogueTrees={() => {}}
          activeDialogueTab={0}
          setActiveDialogueTab={() => {}}
          dialogueTabToDelete={null}
          setDialogueTabToDelete={() => {}}
          onCreateVendorStockGroup={async () => null}
          getEditingObjectProperty={() => ''}
          updateEditingObjectProperty={() => {}}
          onSave={() => {}}
        />
      </AppProvider>,
    );
    const text = container.textContent || '';
    expect(text).toContain('Guard · Shop');
    expect(text).not.toMatch(/\bDialogue\b/);
    expect(text).not.toMatch(/\bQuest\b/);
    expect(container.querySelectorAll('[aria-label="Save"]')).toHaveLength(1);
  });
});
