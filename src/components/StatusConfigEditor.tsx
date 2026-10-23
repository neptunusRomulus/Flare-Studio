import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw, Search, ChevronDown, ChevronUp, Activity, Heart, Zap, BarChart } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { loadConfigDocument, saveConfigDocument } from '@/editor/projectFiles';
import StatusReferencePanel from '@/components/StatusReferencePanel';

type Props = {
  leftCollapsed: boolean;
};

const STATUS_CONFIG_FILES = [
  { id: 'damage_types', name: 'damage_types.txt', relative: 'engine/damage_types.txt', icon: Zap, category: 'Core' },
  { id: 'primary_stats', name: 'primary_stats.txt', relative: 'engine/primary_stats.txt', icon: BarChart, category: 'Core' },
  { id: 'resource_stats', name: 'resource_stats.txt', relative: 'engine/resource_stats.txt', icon: Heart, category: 'Core' },
  { id: 'combat_text', name: 'combat_text.txt', relative: 'engine/combat_text.txt', icon: Activity, category: 'UI' },
];

export default function StatusConfigEditor({ leftCollapsed }: Props) {
  const ctx = useAppContext();
  const currentProjectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [activeFile, setActiveFile] = React.useState<string>('damage_types');
  const [searchText, setSearchText] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [isEditing, setIsEditing] = React.useState(false);

  const loadFile = async (fileId: string) => {
    const file = STATUS_CONFIG_FILES.find((entry) => entry.id === fileId);
    setActiveFile(fileId);
    if (!file) return;
    try {
      setContent(await loadConfigDocument(currentProjectPath, file.relative));
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  };

  const saveFile = async () => {
    const file = STATUS_CONFIG_FILES.find((entry) => entry.id === activeFile);
    if (!file || !currentProjectPath) {
      toast({ title: 'No project', description: 'Open a project before saving this file.', variant: 'destructive' });
      return;
    }
    const saved = await saveConfigDocument(currentProjectPath, file.relative, content);
    toast(saved
      ? { title: 'Saved', description: file.relative }
      : { title: 'Save failed', description: file.relative, variant: 'destructive' });
  };

  const refreshFile = async () => {
    await loadFile(activeFile);
  };

  React.useEffect(() => {
    void loadFile(activeFile);
  }, [activeFile, currentProjectPath]);

  return (
    <div className="space-y-3">
      <StatusReferencePanel />
      {/* File Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Config Files
        </label>
        <div className="space-y-1">
          {STATUS_CONFIG_FILES.map((file) => (
            <button
              key={file.id}
              onClick={() => loadFile(file.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                activeFile === file.id
                  ? 'bg-orange-600/10 text-orange-600 border border-orange-600/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={file.name}
            >
              <file.icon className="w-4 h-4" />
              {!leftCollapsed && <span className="truncate">{file.name}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
              className="w-full max-w-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={saveFile} disabled={!isEditing} title="Save">
              <Save className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={refreshFile} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} title={isEditing ? 'View Mode' : 'Edit Mode'}>
              {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-3 font-mono text-sm">
          {isEditing ? (
            <textarea
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-sm"
              spellCheck={false}
            />
          ) : (
            <pre className="w-full h-full text-muted-foreground whitespace-pre-wrap">
              {content || 'Select a config file to view...'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}