import { useEffect } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type Params = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  handleEditObject: (id: number) => void;
};

export default function useCanvasDoubleClick({ editor, canvasRef, handleEditObject }: Params) {
  useEffect(() => {
    if (!editor || !canvasRef.current) return;

    const handleCanvasDoubleClick = (_event: MouseEvent) => {
      const activeLayer = editor.getActiveLayer();
      if (!activeLayer) return;

      const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
      if (!interactiveLayers.includes(activeLayer.type)) return;

      const hover = editor.getHoverCoordinates();
      if (hover) {
        const objectsAt = editor.getObjectsAtPosition(hover.x, hover.y);
        const objectAtPosition = objectsAt.find(obj => obj.x === hover.x && obj.y === hover.y) || null;
        if (objectAtPosition) {
          handleEditObject(objectAtPosition.id);
        }
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);

    return () => {
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [editor, canvasRef, handleEditObject]);
}
