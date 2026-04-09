import React from 'react';
import TopBar from '@/components/TopBar';
import EditorCanvas from '@/components/EditorCanvas';
import type { MapObject } from '@/types';

type TopBarProps = {
  toolbarExpanded: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
};

type Props = {
  topBarProps: TopBarProps;
  canvasCtx: React.ComponentProps<typeof EditorCanvas>['ctx'];
  bottomToolbarProps: React.ComponentProps<typeof EditorCanvas>['bottomToolbarProps'];
  isDarkMode: boolean;
};

const EditorArea: React.FC<Props> = ({ topBarProps, canvasCtx, bottomToolbarProps, isDarkMode }) => {
  return (
    <section className="flex-1 min-w-0 flex flex-col relative">
      <TopBar
        toolbarExpanded={topBarProps.toolbarExpanded}
        containerRef={topBarProps.containerRef}
        onMouseEnter={topBarProps.onMouseEnter}
        onMouseLeave={topBarProps.onMouseLeave}
        onFocus={topBarProps.onFocus}
        onBlur={topBarProps.onBlur}
        handleUndo={topBarProps.handleUndo}
        handleRedo={topBarProps.handleRedo}
        handleZoomIn={topBarProps.handleZoomIn}
        handleZoomOut={topBarProps.handleZoomOut}
        handleResetZoom={topBarProps.handleResetZoom}
      />

      <EditorCanvas ctx={canvasCtx} bottomToolbarProps={bottomToolbarProps} isDarkMode={isDarkMode} />
    </section>
  );
};

export default EditorArea;
