import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import type { ProjectStart } from '@/flare/projectTemplate';

export const PROJECT_START_TIPS = {
  scratch: 'An empty project. You import your own tilesets.',
  template:
    'Starts with the tilesets from the installed Flare (fantasycore) already loaded, so you can paint right away.',
  templateMissing: 'Install Flare Modern or Flare Classic on the Welcome screen first.',
};

interface ProjectStartToggleProps {
  value: ProjectStart;
  onChange: (value: ProjectStart) => void;
  templateAvailable: boolean;
}

const ProjectStartToggle: React.FC<ProjectStartToggleProps> = ({ value, onChange, templateAvailable }) => {
  const options: { id: ProjectStart; label: string; tip: string; disabled: boolean }[] = [
    { id: 'scratch', label: 'Start from scratch', tip: PROJECT_START_TIPS.scratch, disabled: false },
    {
      id: 'template',
      label: 'Start with template',
      tip: templateAvailable ? PROJECT_START_TIPS.template : PROJECT_START_TIPS.templateMissing,
      disabled: !templateAvailable,
    },
  ];
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Project start">
      {options.map((o) => (
        <div key={o.id} className="flex-1">
          <Tooltip content={o.tip} side="bottom" className="w-full">
            <Button
              type="button"
              size="sm"
              role="radio"
              aria-checked={value === o.id}
              // aria-disabled instead of disabled so the tooltip still opens on hover.
              aria-disabled={o.disabled || undefined}
              data-testid={`project-start-${o.id}`}
              className={`w-full ${o.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              variant={value === o.id ? 'default' : 'outline'}
              onClick={() => {
                if (!o.disabled) onChange(o.id);
              }}
            >
              {o.label}
            </Button>
          </Tooltip>
        </div>
      ))}
    </div>
  );
};

export default ProjectStartToggle;
