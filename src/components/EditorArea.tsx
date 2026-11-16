import React from 'react';
import TopBar from '@/components/TopBar';
import type { PlayButtonProps } from '@/components/PlayButton';
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
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  isEnemyTabActive: boolean;
  play?: PlayButtonProps;
};

type Props = {
  topBarProps: TopBarProps;
  canvasCtx: React.ComponentProps<typeof EditorCanvas>['ctx'];
  bottomToolbarProps: React.ComponentProps<typeof EditorCanvas>['bottomToolbarProps'];
  isDarkMode: boolean;
  overlay?: React.ReactNode;
};

const EditorArea: React.FC<Props> = ({ topBarProps, canvasCtx, bottomToolbarProps, isDarkMode, overlay }) => {
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
        tipsMinimized={topBarProps.tipsMinimized}
        setTipsMinimized={topBarProps.setTipsMinimized}
        setShowHelp={topBarProps.setShowHelp}
        isEnemyTabActive={topBarProps.isEnemyTabActive}
        play={topBarProps.play}
      />

      {overlay}
      <EditorCanvas ctx={canvasCtx} bottomToolbarProps={bottomToolbarProps} isDarkMode={isDarkMode} />
    </section>
  );
};

export default EditorArea;
