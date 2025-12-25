import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type SeparateBrushDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

const SeparateBrushDialog = ({ open, onOpenChange, onConfirm }: SeparateBrushDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Separate Brush</DialogTitle>
          <DialogDescription>
            Are you sure you want to separate this brush?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Separate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SeparateBrushDialog;
