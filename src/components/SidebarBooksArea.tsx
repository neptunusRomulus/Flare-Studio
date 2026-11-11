import { useCallback, useEffect, useState } from 'react';
import { Book, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bookRelPath, DEFAULT_BOOK_TEMPLATE } from '@/editor/bookFile';
import { OPEN_BOOK_EVENT } from '@/components/BookEditorView';

type Props = { projectPath?: string | null };

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const SidebarBooksArea = ({ projectPath }: Props) => {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [books, setBooks] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const refresh = useCallback(async () => {
    if (!root || !window.electronAPI?.readDir) { setBooks([]); return; }
    const entries = await window.electronAPI.readDir(projectFile(root, 'books')) || [];
    const names = entries
      .filter((entry: { isDirectory?: boolean; name: string }) => !entry.isDirectory && entry.name.endsWith('.txt'))
      .map((entry: { name: string }) => `books/${entry.name}`)
      .sort();
    setBooks(names);
    return names as string[];
  }, [root]);

  useEffect(() => { void refresh(); }, [refresh]);

  const open = (path: string) => {
    setSelected(path);
    window.dispatchEvent(new CustomEvent(OPEN_BOOK_EVENT, { detail: path }));
  };

  const create = async () => {
    const rel = bookRelPath(title || 'book');
    if (!root || !window.electronAPI?.writeFile) return;
    await window.electronAPI.writeFile(projectFile(root, rel), DEFAULT_BOOK_TEMPLATE);
    setCreating(false);
    setTitle('');
    const names = await refresh();
    if (names) open(rel);
    else open(rel);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Books</div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
          <Plus className="w-3 h-3 mr-1" /> Book
        </Button>
      </div>
      {creating && (
        <div className="flex gap-1">
          <Input className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" autoFocus />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void create()}>Create</Button>
        </div>
      )}
      <div className="space-y-0.5">
        {books.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => open(path)}
            className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${selected === path ? 'bg-muted' : 'hover:bg-muted/60'}`}
          >
            <Book className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate">{path.replace(/^books\//, '').replace(/\.txt$/, '')}</span>
          </button>
        ))}
        {books.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-1">No books/*.txt files yet.</p>
        )}
      </div>
    </div>
  );
};

export default SidebarBooksArea;
