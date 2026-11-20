import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Tooltip from '@/components/ui/tooltip';
import { useStudioHints } from '@/context/StudioHintsContext';
import { cn } from '@/lib/utils';

type HintProps = {
  hint?: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  className?: string;
  children: React.ReactNode;
};

/** Shows a tooltip on hover when studio hints are enabled. Hidden entirely when they are off. */
export function FieldHint({ hint, side = 'top', className, children }: HintProps) {
  const { hintsEnabled } = useStudioHints();
  if (!hint || !hintsEnabled) return <>{children}</>;
  return (
    <Tooltip content={hint} side={side} className={cn('max-w-full', className)}>
      <span className="contents" data-studio-hint={typeof hint === 'string' ? hint : undefined}>
        {children}
      </span>
    </Tooltip>
  );
}

type HintLabelProps = React.ComponentProps<typeof Label> & {
  hint?: React.ReactNode;
  side?: HintProps['side'];
};

/** Label that carries its helper text as a hover tooltip instead of a visible caption. */
export function HintLabel({ hint, side, children, ...props }: HintLabelProps) {
  return (
    <FieldHint hint={hint} side={side}>
      <Label {...props}>{children}</Label>
    </FieldHint>
  );
}

/** Help icon that only appears when studio hints are enabled. Prefer HintLabel on the field itself. */
export function HintIcon({
  hint,
  side,
  className,
}: {
  hint?: React.ReactNode;
  side?: HintProps['side'];
  className?: string;
}) {
  const { hintsEnabled } = useStudioHints();
  if (!hint || !hintsEnabled) return null;
  return (
    <Tooltip content={hint} side={side}>
      <HelpCircle className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground cursor-help', className)} />
    </Tooltip>
  );
}
