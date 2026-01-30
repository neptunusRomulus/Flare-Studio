import { Button } from '@/components/ui/button';
import { Eraser, Link2, Map, Paintbrush2, PaintBucket, Pipette, Save, Settings, Shield, Square, Target, Upload, Wand2, X, Book } from 'lucide-react';
import { useState } from 'react';
import DocumentationViewer from './DocumentationViewer';

type HelpDialogProps = {
  open: boolean;
  activeTab: 'engine' | 'collisions' | 'documentation';
  setActiveTab: (tab: 'engine' | 'collisions' | 'documentation') => void;
  onClose: () => void;
};

const HelpDialog = ({ open, activeTab, setActiveTab, onClose }: HelpDialogProps) => {
  const [showDocViewer, setShowDocViewer] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-0 w-[800px] max-h-[80vh] overflow-y-auto help-modal relative">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Help & Documentation</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="w-8 h-8 p-0 rounded-full"
              aria-label="Close Help"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex space-x-1 mt-3 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('engine')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'engine'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Engine
            </button>
            <button
              onClick={() => setActiveTab('collisions')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'collisions'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Collisions
            </button>
            <button
              onClick={() => setShowDocViewer(true)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-neutral-700/50`}
            >
              <Book className="w-4 h-4 inline mr-2" />
              Documentation
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'engine' && (
            <>
              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <Target className="w-5 h-5 text-orange-500" />
                  Getting Started
                </h4>
                <div className="space-y-2 text-gray-700 dark:text-gray-400">
                  <p>Welcome to the Isometric Tile Map Editor! This tool allows you to create beautiful isometric tile-based maps.</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
                    <li>Start by creating a new map or loading an existing one</li>
                    <li>Import tilesets to begin designing</li>
                    <li>Use layers to organize different elements of your map</li>
                    <li>Export your finished map for use in your projects</li>
                  </ul>
                </div>
              </section>

              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <Map className="w-5 h-5 text-orange-500" />
                  Map Management
                </h4>
                <div className="space-y-3">
                  <p className="text-gray-700 dark:text-gray-400">Layers help organize your map content. Each layer can have its own tileset and transparency.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <Save className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Save/Export</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Save your map as JSON or export as PNG image</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Upload className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Load Map</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Load previously saved JSON map files</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Settings className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Map Settings</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Configure map dimensions, tile size, and other properties</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Link2 className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Lock/Unlock</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Prevent accidental edits to completed layers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <Paintbrush2 className="w-5 h-5 text-orange-500" />
                  Drawing Tools
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3">
                    <Paintbrush2 className="w-4 h-4 mt-1 text-orange-500" />
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-100">Brush Tool</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Paint individual tiles by clicking</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <PaintBucket className="w-4 h-4 mt-1 text-orange-500" />
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-100">Bucket Fill</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Fill connected areas with the same tile</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Eraser className="w-4 h-4 mt-1 text-orange-500" />
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-100">Eraser</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Remove tiles from the map</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Pipette className="w-4 h-4 mt-1 text-orange-500" />
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-100">Eyedropper</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Select a tile from the map to use as brush</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <Square className="w-5 h-5 text-orange-500" />
                  Tileset Management
                </h4>
                <div className="space-y-3">
                  <p className="text-gray-700 dark:text-gray-400">Each layer can have its own tileset. Import PNG images to use as tilesets.</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Upload className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Import Tileset</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click the upload button for each layer to import a tileset image</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <X className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium text-gray-800 dark:text-gray-100">Remove Tileset</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Use the red X button to remove a tileset from a layer</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Keyboard Shortcuts
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-neutral-900 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Z</span>
                      <span className="text-sm text-gray-400">Undo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Y</span>
                      <span className="text-sm text-gray-400">Redo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+S</span>
                      <span className="text-sm text-gray-400">Save Map</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Mouse Wheel</span>
                      <span className="text-sm text-gray-400">Zoom</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Middle Click + Drag</span>
                      <span className="text-sm text-gray-400">Pan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Hover + Wheel</span>
                      <span className="text-sm text-gray-400">Layer Transparency</span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-orange-500" />
                  Tips & Best Practices
                </h4>
                <div className="space-y-2 text-gray-700 dark:text-gray-400">
                  <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
                    <li>Use separate layers for different map elements (background, objects, decorations)</li>
                    <li>Name your layers descriptively for better organization</li>
                    <li>Lock completed layers to prevent accidental changes</li>
                    <li>Adjust layer transparency to see underlying elements while editing</li>
                    <li>Use the eyedropper tool to quickly select tiles from existing map areas</li>
                    <li>Save frequently to avoid losing work</li>
                    <li>Test your map export to ensure it looks correct in your target application</li>
                  </ul>
                </div>
              </section>
            </>
          )}

          {activeTab === 'collisions' && (
            <>
              <section>
                <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <Shield className="w-5 h-5 text-orange-500" />
                  Summary of Collision Values for Flare
                </h4>
                <div className="space-y-4">
                  <p className="text-gray-700 dark:text-gray-400">
                    Collision values in Flare Engine determine how entities interact with map tiles. Each value has specific behavior that affects movement and visibility.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Value</th>
                          <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Type</th>
                          <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Behavior</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 dark:text-gray-300">
                        <tr>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">1</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Red Block</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Impassable wall, visible on minimap</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">2</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Dithered Red</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Still blocks entities, minimap shows dithered tile</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">3</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Pit (Blue)</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Ground entities blocked; air can pass</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">4</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Dithered Pit</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Same as 3, but minimap shows dithered</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Usage Guidelines
                    </h5>
                    <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1 list-disc list-inside">
                      <li><strong>Value 1 (Red Block):</strong> Use for walls, buildings, and solid obstacles that should be clearly visible on the minimap</li>
                      <li><strong>Value 2 (Dithered Red):</strong> Use for partial barriers or decorative walls that still block movement</li>
                      <li><strong>Value 3 (Pit):</strong> Use for water, lava, or ground hazards that flying entities can cross</li>
                      <li><strong>Value 4 (Dithered Pit):</strong> Use for shallow water or transitional pit areas</li>
                    </ul>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Notes</h5>
                    <ul className="text-amber-700 dark:text-amber-300 text-sm space-y-1 list-disc list-inside">
                      <li>Collision values are set in the <strong>Collision Layer</strong> of your map</li>
                      <li>Each tile position can only have one collision value</li>
                      <li>Collision affects AI pathfinding and player movement</li>
                      <li>Minimap visualization helps players understand map layout</li>
                    </ul>
                  </div>
                </div>
              </section>
            </>
          )}

          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Flare Studio | GUI for Flare Engine by ism.
            </p>
          </div>
        </div>
      </div>

      {/* Documentation Viewer Modal */}
      <DocumentationViewer open={showDocViewer} onClose={() => setShowDocViewer(false)} />
    </div>
  );
};

export default HelpDialog;
