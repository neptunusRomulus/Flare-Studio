import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';

type ConfirmAction = { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | { layerType: string; tabId: number } } | null;

type Props = {
  action: ConfirmAction;
  onCancel: () => void;
  onConfirm: () => void;
};

const ConfirmActionDialog: React.FC<Props> = ({ action, onCancel, onConfirm }) => {
  if (!action) return null;
  const getMessage = () => {
    switch (action.type) {
      case 'removeBrush':
        return 'Are you sure you want to remove this brush?';
      case 'removeTileset':
        return 'Are you sure you want to remove the tileset for this layer? This will clear the tileset but keep any placed tiles.';
      case 'removeTab':
        return 'Are you sure you want to remove this tileset tab?';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Confirm</h3>
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-8 h-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-foreground mb-4">{getMessage()}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-10">
            <X className="w-5 h-5" />
          </Button>
          <Button size="sm" onClick={onConfirm} className="w-10">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionDialog;
