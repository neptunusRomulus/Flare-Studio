import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldHint } from '@/components/ui/field-hint';
import { enemyPropertyTooltips } from './enemyModel';

export const enemyInputCls = 'h-7 text-xs';

export const LabelWithTooltip = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
  const hint = enemyPropertyTooltips[field];
  return (
    <FieldHint hint={hint}>
      <Label className={`text-xs text-muted-foreground font-normal flex items-center gap-1 ${className || ''}`}>
        {children}
      </Label>
    </FieldHint>
  );
};

export const MoreToggle = ({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Button type="button" variant="ghost" className="h-auto p-0 text-[10px] text-muted-foreground underline underline-offset-2 hover:bg-transparent hover:text-muted-foreground" onClick={onToggle}>
      {open ? 'Less' : 'More'}
    </Button>
    {open ? children : null}
  </div>
);

export const EditorSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </section>
);

export const Flag = ({ checked, onChange, label, tip }: { checked: boolean; onChange: (on: boolean) => void; label: string; tip?: string }) => (
  <FieldHint hint={tip}>
    <Label className="flex items-center gap-2 cursor-pointer font-normal">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} className="h-3.5 w-3.5" />
      <span className="text-xs">{label}</span>
    </Label>
  </FieldHint>
);
