import React from 'react';
import TitleBar from '@/components/top/TitleBar';

type Props = {
  titleBarProps: React.ComponentProps<typeof TitleBar>;
};

export default function AppShell({ titleBarProps }: Props) {
  return (
    <>
      <TitleBar {...titleBarProps} />
    </>
  );
}
