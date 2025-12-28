import React from 'react';
import TitleBar from '@/components/TitleBar';
import SidebarToggle from '@/components/SidebarToggle';

type Props = {
  titleBarProps: React.ComponentProps<typeof TitleBar>;
  sidebarToggleProps: React.ComponentProps<typeof SidebarToggle>;
};

export default function AppShell({ titleBarProps, sidebarToggleProps }: Props) {
  return (
    <>
      <TitleBar {...titleBarProps} />
      <SidebarToggle {...sidebarToggleProps} />
    </>
  );
}
