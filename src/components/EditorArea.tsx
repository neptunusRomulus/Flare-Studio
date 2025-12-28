import React from 'react';
import TopBar from '@/components/TopBar';
import EnemyTabPanel from '@/components/EnemyTabPanel';
import EditorCanvas from '@/components/EditorCanvas';

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

type EnemyPanelProps = {
  isEnemyActive: boolean;
  enemy: any;
  showCloseConfirm: boolean;
  onCloseDecision: (decision: string) => void;
  onSave: (data: any) => void;
};

type Props = {
  topBarProps: TopBarProps;
  canvasCtx: any;
  bottomToolbarProps: any;
  enemyPanelProps: EnemyPanelProps;
};

const EditorArea: React.FC<Props> = ({ topBarProps, canvasCtx, bottomToolbarProps, enemyPanelProps }) => {
  if (enemyPanelProps.isEnemyActive) {
    return (
      <section className="flex-1 min-w-0 flex flex-col relative">
        <div className="p-6 h-full overflow-auto">
          <EnemyTabPanel
            enemy={enemyPanelProps.enemy}
            showCloseConfirm={enemyPanelProps.showCloseConfirm}
            onCloseDecision={enemyPanelProps.onCloseDecision}
            onSave={enemyPanelProps.onSave}
          />
        </div>
      </section>
    );
  }

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

      <EditorCanvas ctx={canvasCtx} bottomToolbarProps={bottomToolbarProps} />
    </section>
  );
};

export default EditorArea;
