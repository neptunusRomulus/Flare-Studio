import { useState } from 'react';
import type { Stamp } from '@/types';

const useStampState = () => {
  const [brushTool, setBrushTool] = useState<'none' | 'move' | 'merge' | 'separate' | 'remove'>('none');
  const [showSeparateDialog, setShowSeparateDialog] = useState(false);
  const [brushToSeparate, setBrushToSeparate] = useState<number | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<'select' | 'create' | 'place'>('select');
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');

  return {
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    brushToSeparate,
    setBrushToSeparate,
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    showStampDialog,
    setShowStampDialog,
    newStampName,
    setNewStampName
  };
};

export default useStampState;
