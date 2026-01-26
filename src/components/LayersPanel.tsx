import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import type { TileLayer } from '@/types';
import {
  Eye,
  EyeOff,
  Mouse,
  Blend,
  Image as MapImage,
  Grid,
  Box,
  Sword,
  GitBranch,
  Users,
  Locate,
  Clock,
  Map as MapIcon
} from 'lucide-react';

type Props = {
  layers: TileLayer[];
  activeLayerId: number | null;
  hoveredLayerId: number | null;
  layersPanelExpanded: boolean;
  setLayersPanelExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setHoveredLayerId: React.Dispatch<React.SetStateAction<number | null>>;
  handleSetActiveLayer: (id: number) => void;
  handleToggleLayerVisibility: (id: number) => void;
  showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
  hideTooltip: () => void;
  handleLayerTransparencyChange: (id: number, delta: number) => void;
  leftCollapsed: boolean;
};

const LayersPanel: React.FC<Props> = ({
  layers,
  activeLayerId,
  hoveredLayerId,
  layersPanelExpanded,
  setLayersPanelExpanded,
  setHoveredLayerId,
  handleSetActiveLayer,
  handleToggleLayerVisibility,
  showTooltipWithDelay,
  hideTooltip,
  handleLayerTransparencyChange,
  leftCollapsed
}) => {
  useEffect(() => {
    try { console.log('[DEBUG] LayersPanel: activeLayerId =', activeLayerId); } catch (e) { /* ignore */ }
  }, [activeLayerId]);

  return (
    <section
      className="mb-0 flex-shrink-0 flex flex-col justify-center h-auto"
      onMouseEnter={() => setLayersPanelExpanded(true)}
      onMouseLeave={() => {
        try {
          if ((window as any).__preventLayersAutoCollapse) return;
        } catch (e) { /* ignore */ }
        setLayersPanelExpanded(false);
      }}
      tabIndex={0}
    >
      <div className="mb-2 w-full flex flex-col justify-center h-full">
        {/* Active badge removed — using console log in useEffect instead */}
        <div className="h-auto overflow-hidden flex flex-col justify-center w-full">
          <div className="space-y-0.5 h-auto overflow-y-visible flex flex-col justify-center w-full">
            {layers.filter(layer => layer.type !== 'actions').map((layer) => {
              const isActive = activeLayerId === layer.id;
              const isHovered = hoveredLayerId === layer.id;
              const visible = layersPanelExpanded || isActive;
              return (
                <div
                  key={layer.id}
                  className={`block w-full max-w-xs px-2 py-1 rounded transition-all text-xs transform-gpu ${
                    isActive
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400'
                      : isHovered
                      ? 'bg-orange-100/50 dark:bg-orange-800/15 border-orange-300/50'
                      : 'bg-transparent border-transparent'
                  }`}
                  style={{
                    opacity: visible ? 1 : 0.85,
                    transform: visible ? 'scaleY(1) translateY(0)' : 'scaleY(0.98) translateY(0)',
                    transformOrigin: 'top',
                    transition: 'transform 400ms cubic-bezier(.2,.9,.2,1), opacity 400ms ease, box-shadow 300ms ease, background-color 150ms ease',
                    boxShadow: isActive ? '0 6px 12px rgba(15,23,42,0.06)' : isHovered ? '0 2px 6px rgba(251,146,60,0.15)' : 'none',
                    zIndex: isActive ? 30 : isHovered ? 20 : 10,
                  }}
                  onMouseEnter={() => setHoveredLayerId(layer.id)}
                  onMouseLeave={() => setHoveredLayerId(null)}
                >
                  <div
                    className="cursor-pointer w-full flex items-center"
                    onClick={(e) => {
                      // debug: log click reaching LayersPanel
                      try { console.log('LayersPanel clicked', layer.id); } catch (err) {}
                      handleSetActiveLayer(layer.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSetActiveLayer(layer.id);
                      }
                    }}
                    style={{
                      transition: 'transform 180ms cubic-bezier(.2,.9,.2,1)',
                      transform: isHovered ? 'translateY(-3px) scale(1.02)' : 'none'
                    }}
                  >
                    <div className={`flex items-center gap-2 w-full ${isActive ? 'opacity-100' : isHovered ? 'opacity-95' : 'opacity-80'}`}> 
                      <Tooltip content={layer.visible ? 'Hide layer' : 'Show layer'}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLayerVisibility(layer.id);
                          }}
                          className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          {layer.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />}
                        </Button>
                      </Tooltip>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        onMouseEnter={(e) => {
                          const transparencyPercent = Math.round((layer.transparency || 0) * 100);
                          showTooltipWithDelay(
                            <div className="flex items-center gap-1">
                              <Mouse className="w-3 h-3" />
                              Transparency ({transparencyPercent}%)
                            </div>,
                            e.currentTarget
                          );
                        }}
                        onMouseLeave={hideTooltip}
                        onWheel={(e) => {
                          e.preventDefault();
                          const delta = e.deltaY > 0 ? 0.1 : -0.1;
                          handleLayerTransparencyChange(layer.id, delta);
                          const currentTransparency = layer.transparency || 0;
                          const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
                          const newPercent = Math.round(newTransparency * 100);
                          showTooltipWithDelay(
                            <div className="flex items-center gap-1">
                              <Mouse className="w-3 h-3" />
                              Transparency ({newPercent}%)
                            </div>,
                            e.currentTarget
                          );
                        }}
                      >
                        <Blend className="w-2.5 h-2.5" />
                      </Button>

                      <div className="flex items-center gap-2">
                        <Tooltip content={layer.type === 'rules' ? 'When this happens → do this' : layer.name}>
                          <span className="text-xs font-medium truncate flex items-center gap-2">
                            {(() => {
                              switch ((layer.type || '').toLowerCase()) {
                                case 'background':
                                case 'bg':
                                  return <MapImage className="w-4 h-4" />;
                                case 'collision':
                                case 'collision layer':
                                  return <Grid className="w-4 h-4" />;
                                case 'objects':
                                case 'object':
                                  return <Box className="w-4 h-4" />;
                                case 'items':
                                  return <Sword className="w-4 h-4" />;
                                case 'rules':
                                  return <GitBranch className="w-4 h-4" />;
                                case 'npc':
                                  return <Users className="w-4 h-4" />;
                                case 'enemy':
                                  return <Locate className="w-4 h-4" />;
                                case 'event':
                                  return <Clock className="w-4 h-4" />;
                                default:
                                  return <MapIcon className="w-4 h-4" />;
                              }
                            })()}
                          </span>
                        </Tooltip>
                        <span className={leftCollapsed ? 'sr-only text-xs font-medium' : 'text-xs font-medium truncate'} title={layer.name}>
                          {layer.name.replace(/ Layer$/i, '')}
                          <span className="ml-2 text-[10px] text-gray-500">#{layer.id}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LayersPanel;
