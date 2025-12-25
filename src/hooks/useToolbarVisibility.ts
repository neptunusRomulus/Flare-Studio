import { useEffect } from 'react';

type ToolbarControls = {
  clearCollapseTimer: () => void;
  showTemporarily: () => void;
  setExpanded: (next: boolean) => void;
};

type ToolbarVisibilityOptions = {
  showWelcome: boolean;
  mapInitialized: boolean;
  toolbar: ToolbarControls;
  brushToolbar: ToolbarControls;
  bottomToolbar: ToolbarControls;
};

const useToolbarVisibility = ({
  showWelcome,
  mapInitialized,
  toolbar,
  brushToolbar,
  bottomToolbar
}: ToolbarVisibilityOptions) => {
  useEffect(() => {
    return () => {
      toolbar.clearCollapseTimer();
    };
  }, [toolbar]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      toolbar.showTemporarily();
    }
  }, [showWelcome, mapInitialized, toolbar]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      toolbar.setExpanded(true);
      toolbar.clearCollapseTimer();
    }
  }, [showWelcome, mapInitialized, toolbar]);

  useEffect(() => {
    return () => {
      brushToolbar.clearCollapseTimer();
    };
  }, [brushToolbar]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      brushToolbar.showTemporarily();
    }
  }, [showWelcome, mapInitialized, brushToolbar]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      brushToolbar.setExpanded(true);
      brushToolbar.clearCollapseTimer();
    }
  }, [showWelcome, mapInitialized, brushToolbar]);

  useEffect(() => {
    return () => {
      bottomToolbar.clearCollapseTimer();
    };
  }, [bottomToolbar]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      bottomToolbar.showTemporarily();
    }
  }, [showWelcome, mapInitialized, bottomToolbar]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      bottomToolbar.setExpanded(true);
      bottomToolbar.clearCollapseTimer();
    }
  }, [showWelcome, mapInitialized, bottomToolbar]);
};

export default useToolbarVisibility;
