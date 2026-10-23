import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Users, Sword, Tag, FileText, Database, Wrench, Layers, Palette, Gamepad2, Library } from 'lucide-react';
import ItemConfigEditor from './ItemConfigEditor';
import StatusConfigEditor from './StatusConfigEditor';
import ActorConfigEditor from './ActorConfigEditor';
import GameSettingsConfigEditor from './GameSettingsConfigEditor';
import { StudioWorldPanel } from './studio/studioEditors';

type Props = {
  isGameSettingsLayer: boolean;
  leftCollapsed: boolean;
};

export default function SidebarGameSettingsArea({ isGameSettingsLayer, leftCollapsed }: Props) {
  if (!isGameSettingsLayer) return null;

  const [activeTab, setActiveTab] = React.useState<'items' | 'statuses' | 'actors' | 'game' | 'world'>('items');

  const tabs = [
    { id: 'items' as const, icon: Sword, label: 'Items', description: 'Items, categories, qualities' },
    { id: 'statuses' as const, icon: Tag, label: 'Statuses', description: 'Damage types, stats, resources' },
    { id: 'actors' as const, icon: Users, label: 'Actors', description: 'Classes, powers, spells, equip flags' },
    { id: 'game' as const, icon: Settings, label: 'Game', description: 'Combat, gameplay, UI, global settings' },
    { id: 'world' as const, icon: Library, label: 'World', description: 'Cutscenes, languages, parallax, fog, procgen' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {/* Tab Bar */}
      <div className="flex gap-1 mb-3 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-orange-600 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={tab.description}
          >
            <tab.icon className="w-4 h-4" />
            {!leftCollapsed && <span>{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {activeTab === 'items' && <ItemConfigEditor leftCollapsed={leftCollapsed} />}
        {activeTab === 'statuses' && <StatusConfigEditor leftCollapsed={leftCollapsed} />}
        {activeTab === 'actors' && <ActorConfigEditor leftCollapsed={leftCollapsed} />}
        {activeTab === 'game' && <GameSettingsConfigEditor leftCollapsed={leftCollapsed} />}
        {activeTab === 'world' && <StudioWorldPanel />}
      </div>
    </div>
  );
}