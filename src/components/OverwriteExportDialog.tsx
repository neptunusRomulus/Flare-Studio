import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface OverwriteExportDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OverwriteExportDialog({ open, onConfirm, onCancel }: OverwriteExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-md bg-red-50 dark:bg-red-900 border-red-400 dark:border-red-700 animate-shake">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 animate-pulse" />
            <DialogTitle className="text-red-700 dark:text-red-300 text-xl font-bold">
              Danger: Overwrite Export
            </DialogTitle>
          </div>
          <DialogDescription className="text-red-700 dark:text-red-300 font-semibold text-base">
            Older export detected inside project folder.<br />
            <span className="font-bold">This process will <span className="underline">replace your older files</span>.</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-4">
          <Button variant="destructive" className="w-full text-lg font-bold py-3 animate-pulse" onClick={onConfirm}>
            Yes, Overwrite Old Export
          </Button>
          <Button variant="outline" className="w-full text-lg font-bold py-3" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
