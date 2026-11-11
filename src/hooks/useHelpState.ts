import { useState } from 'react';

const useHelpState = () => {
  const [showHelp, setShowHelp] = useState(false);

  return {
    showHelp,
    setShowHelp,
  };
};

export default useHelpState;
