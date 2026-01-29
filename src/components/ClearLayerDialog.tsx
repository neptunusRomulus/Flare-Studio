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
    <>
      {/* Dismissible overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Chat balloon - centered on screen */}
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 backdrop-blur-sm shadow-sm text-xs text-foreground whitespace-nowrap">
          Are you sure?
        </div>
        
        {/* Arrow pointer down */}
        <div className="flex justify-center">
          <div className="w-2 h-2 bg-foreground/5 border-b border-r border-foreground/10 transform rotate-45 -mt-1"></div>
        </div>
        
        {/* Button controls */}
        <div className="flex justify-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-6 h-6 p-0 hover:bg-foreground/10"
            aria-label="Cancel"
          >
            <X className="w-3 h-3 text-foreground/60" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="w-6 h-6 p-0 hover:bg-foreground/10"
            aria-label="Confirm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-foreground/60"><path d="M20 6L9 17l-5-5"/></svg>
          </Button>
        </div>
      </div>
    </>
  );
};

export default ClearLayerDialog;
