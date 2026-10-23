import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw, Search, ChevronDown, ChevronUp, Users, Sparkles, BookOpen, Shield, Sword, Tag } from 'lucide-react';

type Props = {
  leftCollapsed: boolean;
};

const ACTOR_CONFIG_FILES = [
  { id: 'classes', name: 'classes.txt', icon: Users, category: 'Core' },
  { id: 'powers', name: 'powers.txt', icon: Sparkles, category: 'Core' },
  { id: 'spells', name: 'spells.txt', icon: BookOpen, category: 'Core' },
  { id: 'equip_flags', name: 'equip_flags.txt', icon: Shield, category: 'Core' },
];

export default function ActorConfigEditor({ leftCollapsed }: Props) {
  const [activeFile, setActiveFile] = React.useState<string>('classes');
  const [searchText, setSearchText] = React.useState('');
  const [content, setContent] = React.useState<string>('');
  const [isEditing, setIsEditing] = React.useState(false);

  const loadFile = async (fileId: string) => {
    try {
      const filePath = `mods/example/${fileId}.txt`;
      setContent(`# ${fileId} configuration\n# This would load from ${filePath}\n\n[Class]\nid = warrior\nname = Warrior\nhealth = 100\nmana = 20\n`);
      setActiveFile(fileId);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  };

  const saveFile = async () => {
    console.log('Save:', activeFile, content);
  };

  const refreshFile = async () => {
    await loadFile(activeFile);
  };

  React.useEffect(() => {
    loadFile(activeFile);
  }, [activeFile]);

  return (
    <div className="space-y-3">
      {/* File Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Config Files
        </label>
        <div className="space-y-1">
          {ACTOR_CONFIG_FILES.map((file) => (
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