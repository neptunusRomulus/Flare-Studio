import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw, FileText, Plus, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import {
  engineTextFromSections,
  exportTilesetConfig,
  sectionsFromEngineText,
} from '@/adapters/flare/flareAdapter.cjs';
import { projectRoot, saveConfigDocument } from '@/editor/projectFiles';

interface ParsedSection {
  type: string;
  fields: ConfigField[];
  rawLines?: string[];
}

interface ConfigField {
  key: string;
  value: string;
  comment?: string;
}

const ENGINE_CONFIG_FILES = [
  { name: 'classes.txt', displayName: 'Classes', description: 'Hero class definitions' },
  { name: 'damage_types.txt', displayName: 'Damage Types', description: 'Damage type definitions' },
  { name: 'equip_flags.txt', displayName: 'Equipment Flags', description: 'Equipment flag definitions' },
  { name: 'primary_stats.txt', displayName: 'Primary Stats', description: 'Primary stat definitions' },
  { name: 'combat.txt', displayName: 'Combat Settings', description: 'Combat percentage limits' },
  { name: 'combat_text.txt', displayName: 'Combat Text', description: 'Combat text display settings' },
  { name: 'gameplay.txt', displayName: 'Gameplay', description: 'Gameplay enable flags' },
  { name: 'death_penalty.txt', displayName: 'Death Penalty', description: 'Death penalty settings' },
  { name: 'default_music.txt', displayName: 'Default Music', description: 'Default music tracks' },
  { name: 'font_colors.txt', displayName: 'Font Colors', description: 'Font color definitions' },
  { name: 'font_settings.txt', displayName: 'Font Settings', description: 'Font configuration' },
  { name: 'icons.txt', displayName: 'Icons', description: 'Icon definitions' },
  { name: 'languages.txt', displayName: 'Languages', description: 'Supported languages' },
  { name: 'misc.txt', displayName: 'Miscellaneous', description: 'Miscellaneous settings' },
  { name: 'resource_stats.txt', displayName: 'Resource Stats', description: 'Resource stat definitions' },
  { name: 'resolutions.txt', displayName: 'Resolutions', description: 'Supported resolutions' },
  { name: 'tileset_config.txt', displayName: 'Tileset Config', description: 'Tileset configuration' },
  { name: 'tooltips.txt', displayName: 'Tooltips', description: 'Tooltip definitions' },
];

export function EngineConfigEditor() {
  const ctx = useAppContext();
  const currentProjectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [activeTab, setActiveTab] = useState<string>('classes.txt');
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<Record<string, ParsedSection[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({});

  // Load all engine config files
  const loadAllConfigs = async () => {
    if (!currentProjectPath) return;
    
    setIsLoading(true);
    try {
      const enginePath = `${projectRoot(currentProjectPath)}/engine`;
      const contents: Record<string, string> = {};
      const parsed: Record<string, ParsedSection[]> = {};
      
      for (const file of ENGINE_CONFIG_FILES) {
        try {
          const response = window.electronAPI?.readFile
            ? await window.electronAPI.readFile(`${enginePath}/${file.name}`)
            : null;
          if (typeof response === 'string' && response.length > 0) {
            contents[file.name] = response;
            parsed[file.name] = sectionsFromEngineText(response);
          } else if (file.name === 'tileset_config.txt') {
            const indexText = window.electronAPI?.readFile
              ? await window.electronAPI.readFile(`${projectRoot(currentProjectPath)}/project.json`)
              : null;
            let tile: { width?: number; height?: number; orientation?: string } | undefined;
            if (indexText) {
              try {
                tile = JSON.parse(indexText).tile;
              } catch {
                tile = undefined;
              }
            }
            const seeded = exportTilesetConfig(tile);
            contents[file.name] = seeded;
            parsed[file.name] = sectionsFromEngineText(seeded);
          } else {
            contents[file.name] = '';
            parsed[file.name] = [];
          }
        } catch (e) {
          contents[file.name] = '';
          parsed[file.name] = [];
        }
      }
      
      setFileContents(contents);
      setParsedData(parsed);
      setHasUnsavedChanges({});
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load engine configs', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllConfigs();
  }, [currentProjectPath]);

  const rememberSections = (fileName: string, sections: ParsedSection[]) => {
    const text = engineTextFromSections(sections);
    setFileContents((prev) => ({ ...prev, [fileName]: text }));
    setHasUnsavedChanges((prev) => ({ ...prev, [fileName]: true }));
  };

  const saveConfig = async (fileName: string) => {
    if (!currentProjectPath || !hasUnsavedChanges[fileName]) return;
    const content = engineTextFromSections(parsedData[fileName] || []) || fileContents[fileName];
    if (!content) return;
    try {
      const saved = await saveConfigDocument(currentProjectPath, `engine/${fileName}`, content);
      if (saved) {
        setHasUnsavedChanges(prev => ({ ...prev, [fileName]: false }));
        toast({ title: 'Success', description: `Saved engine/${fileName}` });
      } else {
        toast({ title: 'Error', description: `Failed to save ${fileName}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: `Failed to save ${fileName}`, variant: 'destructive' });
    }
  };

  const handleFieldChange = (fileName: string, sectionIndex: number, fieldIndex: number, key: string, value: string) => {
    setParsedData(prev => {
      const sections = [...(prev[fileName] || [])];
      const section = { ...sections[sectionIndex] };
      const fields = [...section.fields];
      fields[fieldIndex] = { ...fields[fieldIndex], [key]: value };
      section.fields = fields;
      sections[sectionIndex] = section;
      rememberSections(fileName, sections);
      return { ...prev, [fileName]: sections };
    });
  };

  const addField = (fileName: string, sectionIndex: number) => {
    setParsedData(prev => {
      const sections = [...(prev[fileName] || [])];
      const section = { ...sections[sectionIndex] };
      section.fields = [...section.fields, { key: '', value: '' }];
      sections[sectionIndex] = section;
      rememberSections(fileName, sections);
      return { ...prev, [fileName]: sections };
    });
  };

  const removeField = (fileName: string, sectionIndex: number, fieldIndex: number) => {
    setParsedData(prev => {
      const sections = [...(prev[fileName] || [])];
      const section = { ...sections[sectionIndex] };
      section.fields = section.fields.filter((_, i) => i !== fieldIndex);
      sections[sectionIndex] = section;
      rememberSections(fileName, sections);
      return { ...prev, [fileName]: sections };
    });
  };

  const addSection = (fileName: string) => {
    setParsedData(prev => {
      const sections = [...(prev[fileName] || [])];
      sections.push({
        type: 'new_section',
        fields: [{ key: '', value: '' }],
        rawLines: []
      });
      rememberSections(fileName, sections);
      return { ...prev, [fileName]: sections };
    });
  };

  const filteredFiles = ENGINE_CONFIG_FILES.filter(f => 
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentProjectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Project Open</h3>
        <p className="text-sm text-muted-foreground">Open a project to edit engine configuration files</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Engine Configuration Editor</h2>
            <p className="text-xs text-muted-foreground">Edit {ENGINE_CONFIG_FILES.length} engine config files</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Reload from disk">
            <Button variant="ghost" size="icon" onClick={loadAllConfigs} disabled={isLoading}>
              <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </Tooltip>
          <Tooltip content="Save all changes">
            <Button variant="default" size="sm" onClick={() => {
              Object.keys(fileContents).forEach((fileName) => {
                if (hasUnsavedChanges[fileName]) void saveConfig(fileName);
              });
            }} disabled={!Object.values(hasUnsavedChanges).some(v => v)}>
              <Save className="w-4 h-4 mr-1" />
              Save All
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border/30">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search config files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-7"
          />
        </div>
      </div>

      {/* File List + Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File List */}
        <div className="w-56 border-r border-border/50 bg-card/50 flex flex-col">
          <div className="p-2 border-b border-border/30">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Config Files</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFiles.map(file => (
              <button
                key={file.name}
                onClick={() => setActiveTab(file.name)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-start gap-2 ${
                  activeTab === file.name 
                    ? 'bg-accent/20 text-accent' 
                    : 'hover:bg-accent/10 text-foreground/80'
                }`}
              >
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium truncate">{file.displayName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{file.name}</div>
                </div>
                {hasUnsavedChanges[file.name] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-auto p-4">
          {fileContents[activeTab] === undefined ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">File not loaded</p>
              <Button variant="ghost" size="sm" onClick={loadAllConfigs} className="mt-2">
                <RefreshCw className="w-3 h-3 mr-1" />
                Reload
              </Button>
            </div>
          ) : (
            <ConfigFileEditor
              fileName={activeTab}
              displayName={filteredFiles.find(f => f.name === activeTab)?.displayName || activeTab}
              sections={parsedData[activeTab] || []}
              onFieldChange={handleFieldChange}
              onAddField={addField}
              onRemoveField={removeField}
              onAddSection={addSection}
              onSave={() => saveConfig(activeTab)}
              hasUnsavedChanges={hasUnsavedChanges[activeTab]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ConfigFileEditorProps {
  fileName: string;
  displayName: string;
  sections: ParsedSection[];
  onFieldChange: (fileName: string, sectionIndex: number, fieldIndex: number, key: string, value: string) => void;
  onAddField: (fileName: string, sectionIndex: number) => void;
  onRemoveField: (fileName: string, sectionIndex: number, fieldIndex: number) => void;
  onAddSection: (fileName: string) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
}

function ConfigFileEditor({ 
  fileName, 
  displayName, 
  sections, 
  onFieldChange, 
  onAddField, 
  onRemoveField,
  onAddSection,
  onSave,
  hasUnsavedChanges 
}: ConfigFileEditorProps) {
  const [editingSection, setEditingSection] = useState<number | null>(null);

  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">{displayName}</h3>
          <Button variant="ghost" size="sm" onClick={() => onAddSection(fileName)}>
            <Plus className="w-3 h-3 mr-1" />
            Add Section
          </Button>
        </div>
        <div className="p-6 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <p className="text-sm">No sections defined yet</p>
          <Button variant="ghost" size="sm" onClick={() => onAddSection(fileName)} className="mt-2">
            <Plus className="w-3 h-3 mr-1" />
            Create First Section
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          {displayName}
          <span className="text-xs text-muted-foreground">({fileName})</span>
          {hasUnsavedChanges && <span className="text-xs text-accent font-medium">● Unsaved</span>}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onAddSection(fileName)}>
            <Plus className="w-3 h-3 mr-1" />
            Add Section
          </Button>
          <Button variant="default" size="sm" onClick={onSave} disabled={!hasUnsavedChanges}>
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <SectionEditor
            key={`${fileName}-${sectionIndex}`}
            section={section}
            sectionIndex={sectionIndex}
            fileName={fileName}
            isEditing={editingSection === sectionIndex}
            onToggleEdit={() => setEditingSection(editingSection === sectionIndex ? null : sectionIndex)}
            onFieldChange={onFieldChange}
            onAddField={onAddField}
            onRemoveField={onRemoveField}
          />
        ))}
      </div>
    </div>
  );
}

interface SectionEditorProps {
  section: ParsedSection;
  sectionIndex: number;
  fileName: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onFieldChange: (fileName: string, sectionIndex: number, fieldIndex: number, key: string, value: string) => void;
  onAddField: (fileName: string, sectionIndex: number) => void;
  onRemoveField: (fileName: string, sectionIndex: number, fieldIndex: number) => void;
}

function SectionEditor({ section, sectionIndex, fileName, isEditing, onToggleEdit, onFieldChange, onAddField, onRemoveField }: SectionEditorProps) {
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={onToggleEdit}
          >
            {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <span className="font-mono text-xs text-accent">{section.type ? `[${section.type}]` : '(no section)'}</span>
        </div>
        {isEditing && (
          <Button variant="ghost" size="sm" onClick={() => onAddField(fileName, sectionIndex)}>
            <Plus className="w-3 h-3 mr-1" />
            Add Field
          </Button>
        )}
      </div>

      {/* Section Content */}
      {isEditing && (
        <div className="p-3 space-y-2">
          {section.fields.map((field, fieldIndex) => (
            <div key={`${fileName}-${sectionIndex}-${fieldIndex}`} className="flex items-center gap-2">
              {field.comment !== undefined && !field.key ? (
                <span className="text-[10px] text-muted-foreground italic flex-1">{field.comment}</span>
              ) : (
                <>
                  <Input
                    type="text"
                    value={field.key}
                    onChange={e => onFieldChange(fileName, sectionIndex, fieldIndex, 'key', e.target.value)}
                    placeholder="key"
                    className="w-32 h-6 text-xs font-mono"
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    type="text"
                    value={field.value}
                    onChange={e => onFieldChange(fileName, sectionIndex, fieldIndex, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 h-6 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={() => onRemoveField(fileName, sectionIndex, fieldIndex)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}