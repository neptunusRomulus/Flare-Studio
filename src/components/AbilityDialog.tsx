import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Zap } from 'lucide-react';

type AbilityDialogProps = {
  open: boolean;
  abilityNameInput: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onCreate: (name: string) => void;
};

const AbilityDialog = ({ open, abilityNameInput, onNameChange, onClose, onCreate }: AbilityDialogProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Add Ability
          </DialogTitle>
          <DialogDescription>Create a new ability for the Actions layer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Ability Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={abilityNameInput}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Fireball"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && abilityNameInput.trim()) {
                  onCreate(abilityNameInput.trim());
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!abilityNameInput.trim()}
            onClick={() => onCreate(abilityNameInput.trim())}
          >
            Create Ability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AbilityDialog;
