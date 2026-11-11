import React, { useEffect, useMemo, useState } from 'react';
import type { MapObject } from '@/types';
import QuestMapView from '@/components/QuestMapView';
import useQuestMapData from '@/hooks/useQuestMapData';
import { deriveQuestGraph, type QuestMapQuestInput } from '@/editor/questMap';

type EditorLike = { getMapObjects?: () => MapObject[] } | null | undefined;

type Props = {
  editor: EditorLike;
  quests: QuestMapQuestInput[];
  projectPath?: string | null;
  mapName?: string;
  onOpenQuest: (questId: string) => void;
  onOpenNpc: (objectId: number) => void;
  onClose: () => void;
};

const objectsSignature = (objects: MapObject[]) =>
  objects
    .filter((o) => o.type === 'npc')
    .map((o) => `${o.id}:${o.name}:${o.x},${o.y}:${String((o.properties as Record<string, unknown>)?.dialogueTrees ?? '').length}:${String((o.properties as Record<string, unknown>)?.portraitPath ?? '')}`)
    .join('|');

/** Quest Map overlay for the Quests sub-target. The editor's objects are re-read while it is open. */
export default function QuestMapContainer({ editor, quests, projectPath, mapName, onOpenQuest, onOpenNpc, onClose }: Props) {
  const [mapObjects, setMapObjects] = useState<MapObject[]>(() => editor?.getMapObjects?.() ?? []);

  useEffect(() => {
    let last = '';
    const read = () => {
      const next = editor?.getMapObjects?.() ?? [];
      const sig = objectsSignature(next);
      if (sig === last) return;
      last = sig;
      setMapObjects(next);
    };
    read();
    const timer = window.setInterval(read, 1500);
    return () => window.clearInterval(timer);
  }, [editor]);

  const { npcs, positions, savePositions } = useQuestMapData({ open: true, projectPath, mapName, mapObjects });
  const graph = useMemo(() => deriveQuestGraph(quests, npcs), [quests, npcs]);

  return (
    <QuestMapView
      graph={graph}
      positions={positions}
      onPositionsChange={savePositions}
      onOpenQuest={onOpenQuest}
      onOpenNpc={onOpenNpc}
      onClose={onClose}
      projectPath={projectPath}
    />
  );
}
