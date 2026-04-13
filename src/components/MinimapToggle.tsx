import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

type MinimapToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const MinimapToggle = ({ checked, onChange }: MinimapToggleProps) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      className="w-4 h-4"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <div className="flex items-center gap-1">
      <label className="text-xs text-muted-foreground">Show on Minimap</label>
      <Tooltip content="If true, this NPC will be shown on the minimap. The default is true.">
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </Tooltip>
    </div>
  </div>
);

export default MinimapToggle;
