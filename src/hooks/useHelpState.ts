import { useState } from 'react';

const useHelpState = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'engine' | 'collisions'>('engine');

  return {
    showHelp,
    setShowHelp,
    activeHelpTab,
    setActiveHelpTab
  };
};

export default useHelpState;
