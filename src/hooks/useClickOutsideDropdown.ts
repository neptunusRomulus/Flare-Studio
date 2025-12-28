import { useEffect } from 'react';

export default function useClickOutsideDropdown(args: {
  open: boolean;
  onClose: () => void;
}) {
  const { open, onClose } = args;

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (open) onClose();
    };

    if (open) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [open, onClose]);
}
