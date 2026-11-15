import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

type MinimapToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const MinimapToggle = ({ checked, onChange }: MinimapToggleProps) => (
  <div className="flex items-center gap-2">
    <Checkbox
      className="w-4 h-4"
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
    <div className="flex items-center gap-1">
      <Label className="text-xs font-normal text-muted-foreground">Show on Minimap</Label>
      <Tooltip content="show_on_minimap — If true, this NPC will be shown on the minimap. The default is true.">
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </Tooltip>
    </div>
  </div>
);

export default MinimapToggle;
