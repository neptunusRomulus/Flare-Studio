import useStampState from './useStampState';

export default function useStamps() {
  const stampState = useStampState() as ReturnType<typeof useStampState>;

  return {
    stamps: stampState.stamps,
    setStamps: stampState.setStamps,
    selectedStamp: stampState.selectedStamp,
    setSelectedStamp: stampState.setSelectedStamp,
    stampMode: stampState.stampMode,
    setStampMode: stampState.setStampMode,
    setShowStampDialog: stampState.setShowStampDialog,
    newStampName: stampState.newStampName,
    setNewStampName: stampState.setNewStampName,
    // pass-through utilities
    selectAndLoadTilesetFile: stampState.selectAndLoadTilesetFile,
    refreshTilesetInfos: stampState.refreshTilesetInfos,
    collectTilesetDataUrls: stampState.collectTilesetDataUrls
  };
}
