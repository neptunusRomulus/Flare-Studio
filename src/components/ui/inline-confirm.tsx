import React from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InlineConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  message?: string;
  children: React.ReactNode;
};

/**
 * Small "Are you sure?" popover shown right under its trigger.
 * It floats over the layout, so opening it never resizes the parent.
 */
export function InlineConfirm({ open, onCancel, onConfirm, message = 'Are you sure?', children }: InlineConfirmProps) {
  return (
    <div className="relative">
      {children}
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 shadow-lg">
          <span className="text-xs">{message}</span>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel} aria-label="Cancel">
            <X className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onConfirm} aria-label="Confirm">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default InlineConfirm;
