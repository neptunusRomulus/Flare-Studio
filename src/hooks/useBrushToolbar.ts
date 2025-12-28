import useToolbarAutoCollapse from './useToolbarAutoCollapse';

export default function useBrushToolbar() {
  const brushToolbar = useToolbarAutoCollapse({ autoCollapse: false });

  const brushToolbarExpanded = brushToolbar.expanded;
  const setBrushToolbarNode = (node: HTMLDivElement | null) => { brushToolbar.setContainerRef(node); };
  const showBrushToolbarTemporarily = () => brushToolbar.showTemporarily();

  return {
    brushToolbarExpanded,
    setBrushToolbarNode,
    showBrushToolbarTemporarily,
    // expose raw controls in case more advanced consumers need them
    brushToolbarControls: brushToolbar
  };
}
