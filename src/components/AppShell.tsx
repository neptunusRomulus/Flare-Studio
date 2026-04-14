import React from 'react';
import TitleBar from '@/components/top/TitleBar';

type Props = {
  titleBarProps: React.ComponentProps<typeof TitleBar>;
  sidebarToggleProps?: {
    show: boolean;
    leftCollapsed: boolean;
    onToggle: () => void;
  };
};

export default function AppShell({ titleBarProps }: Props) {
  return (
    <>
      <TitleBar {...titleBarProps} />
    </>
  );
}
