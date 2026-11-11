import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

type Props = Omit<React.ComponentProps<typeof Input>, 'value'> & { value: string };

/**
 * Input that keeps what the user typed while focused. The file writer trims
 * values, so without this a trailing space ("Fire ") would vanish mid-typing.
 */
const DraftInput = ({ value, onChange, onFocus, onBlur, ...rest }: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { if (draft != null && draft.trim() === value.trim()) return; setDraft((d) => (d == null ? d : null)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input
      {...rest}
      value={draft ?? value}
      onFocus={(e) => { setDraft(value); onFocus?.(e); }}
      onBlur={(e) => { setDraft(null); onBlur?.(e); }}
      onChange={(e) => { setDraft(e.target.value); onChange?.(e); }}
    />
  );
};

export default DraftInput;
