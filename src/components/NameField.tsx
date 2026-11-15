import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type NameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

const NameField = ({
  value,
  onChange,
  placeholder = 'Name',
  label = 'Name',
}: NameFieldProps) => (
  <div>
    <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 text-xs"
    />
  </div>
);

export default NameField;
