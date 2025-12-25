import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { Edit2, Image, Save, User, X } from 'lucide-react';
import { ENEMY_ROLE_OPTIONS, NPC_ROLE_OPTIONS } from '@/editor/actorRoles';
import type { ActorDialogState, ActorRoleKey } from '@/editor/actorRoles';

type ActorDialogProps = {
  actorDialogState: ActorDialogState | null;
  actorDialogError: string | null;
  canUseTilesetDialog: boolean;
  onClose: () => void;
  onFieldChange: (key: 'name' | 'tilesetPath' | 'portraitPath', value: string) => void;
  onRoleToggle: (role: ActorRoleKey) => void;
  onTilesetBrowse: () => void;
  onPortraitBrowse: () => void;
  onSubmit: (openEditor: boolean) => void;
};

const ActorDialog = ({
  actorDialogState,
  actorDialogError,
  canUseTilesetDialog,
  onClose,
  onFieldChange,
  onRoleToggle,
  onTilesetBrowse,
  onPortraitBrowse,
  onSubmit
}: ActorDialogProps) => (
  <Dialog open={actorDialogState !== null} onOpenChange={(open) => (open ? void 0 : onClose())}>
    <DialogContent className="max-w-md">
      <DialogHeader className="relative">
        <DialogTitle>
          {actorDialogState?.type === 'npc' ? 'Add NPC' : 'Add Enemy'}
        </DialogTitle>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 w-6 h-6 p-0 hover:bg-transparent"
          onClick={onClose}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
        <DialogDescription>
          Define the details for this {actorDialogState?.type === 'npc' ? 'NPC' : 'enemy'}.
        </DialogDescription>
      </DialogHeader>
      {actorDialogState && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {actorDialogState.type === 'npc' ? 'NPC Name' : 'Enemy Name'} <span className="text-red-500">*</span>
            </label>
            <Input
              value={actorDialogState.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              placeholder={actorDialogState.type === 'npc' ? 'Village Elder' : 'Goblin Scout'}
            />
          </div>

          <div>
            {(() => {
              const roleOptions = actorDialogState.type === 'npc' ? NPC_ROLE_OPTIONS : ENEMY_ROLE_OPTIONS;
              const hasRoleSelection = roleOptions.some((option) => actorDialogState[option.key]);
              return (
                <>
                  <label className="block text-sm font-medium mb-1">
                    {actorDialogState.type === 'npc' ? 'Roles' : 'Enemy Types'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((option) => {
                      const isActive = actorDialogState[option.key];
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => onRoleToggle(option.key)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            isActive
                              ? `border ${option.badgeClass} ring-1 ring-border/60`
                              : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {actorDialogState.type === 'npc'
                      ? hasRoleSelection
                        ? 'Select one or more roles for this NPC.'
                        : 'Static NPC with no interaction.'
                      : hasRoleSelection
                        ? 'Pick one or more enemy types.'
                        : 'No behavior selected; enemy is unassigned.'}
                  </p>
                </>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tileset Location</label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={actorDialogState.tilesetPath}
                onChange={(event) => onFieldChange('tilesetPath', event.target.value)}
                placeholder="npcs/merchant.png (optional)"
                readOnly={canUseTilesetDialog}
                onClick={canUseTilesetDialog ? onTilesetBrowse : undefined}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-3 gap-2"
                onClick={onTilesetBrowse}
                disabled={!canUseTilesetDialog}
              >
                <Image className="w-4 h-4" />
                <span>Browse</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Portrait Location</label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={actorDialogState.portraitPath}
                onChange={(event) => onFieldChange('portraitPath', event.target.value)}
                placeholder="portraits/merchant.png (optional)"
                readOnly={canUseTilesetDialog}
                onClick={canUseTilesetDialog ? onPortraitBrowse : undefined}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-3 gap-2"
                onClick={onPortraitBrowse}
                disabled={!canUseTilesetDialog}
              >
                <User className="w-4 h-4" />
                <span>Browse</span>
              </Button>
            </div>
          </div>

          {actorDialogError && (
            <div className="text-sm text-red-500">
              {actorDialogError}
            </div>
          )}
        </div>
      )}
      <DialogFooter className="mt-4">
        <div className="flex gap-0 divide-x divide-white/20 rounded-md overflow-hidden shadow-sm">
          <Tooltip content={actorDialogState?.type === 'npc' ? 'Add NPC' : 'Add Enemy'} side="top">
            <Button
              onClick={() => onSubmit(false)}
              className="rounded-r-none h-8 px-3 bg-orange-500 hover:bg-orange-600 border-none"
            >
              <Save className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content={actorDialogState?.type === 'npc' ? 'Add and Edit NPC' : 'Add and Edit Enemy'} side="top">
            <Button
              onClick={() => onSubmit(true)}
              className="rounded-l-none h-8 px-3 bg-orange-500 hover:bg-orange-600 border-none"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ActorDialog;
