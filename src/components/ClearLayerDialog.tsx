import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

type ClearLayerDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ClearLayerDialog = ({ open, onClose, onConfirm }: ClearLayerDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Clear Layer</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-foreground mb-4">
          Are you sure you want to clear all tiles from the current layer? This action cannot be undone.
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClearLayerDialog;
