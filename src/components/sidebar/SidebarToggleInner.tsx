import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  leftCollapsed: boolean;
};

export default function SidebarToggleInner({ leftCollapsed }: Props) {
  return (
    <>
      {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
    </>
  );
}
