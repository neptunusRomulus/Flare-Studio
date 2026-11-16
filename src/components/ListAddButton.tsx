import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';

type Props = {
  label: string;
  onClick: () => void;
};

/** Small "+" in a list header (replaces the old labelled orange add pills). */
const ListAddButton: React.FC<Props> = ({ label, onClick }) => (
  <Tooltip content={label} side="bottom">
    <Button
      type="button"
      variant="default"
      size="icon"
      aria-label={label}
      className="h-7 w-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClick();
      }}
    >
      <Plus className="w-3.5 h-3.5" />
    </Button>
  </Tooltip>
);

export default ListAddButton;
