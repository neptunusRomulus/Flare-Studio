import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  LogOut,
  FolderOpen,
  HelpCircle,
  Copy,
  RotateCcw,
  Package,
  RefreshCw,
  Loader2
} from 'lucide-react';

type MainMenuDialogProps = {
  open: boolean;
  anchorPos: { left: number; top: number } | null;
  onClose: () => void;
  currentProjectPath: string | null;
  onSaveAndQuit: () => Promise<void>;
  onQuit: () => void;
  onShowProjectFolder: () => void;
  onShowHelp: () => void;
  onSaveAsCopy: () => Promise<void>;
  onRestart: () => void;
  onExport: () => void;
  onCheckUpdates: () => void;
};

const MainMenuDialog: React.FC<MainMenuDialogProps> = ({
  open,
  anchorPos,
  onClose,
  currentProjectPath,
  onSaveAndQuit,
  onQuit,
  onShowProjectFolder,
  onShowHelp,
  onSaveAsCopy,
  onRestart,
  onExport,
  onCheckUpdates
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [savingAndQuitting, setSavingAndQuitting] = useState(false);
  const [copyingProject, setCopyingProject] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmQuit(false); return; }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (confirmQuit) setConfirmQuit(false); else onClose(); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose, confirmQuit]);

  if (!open || !anchorPos) return null;

  const hasProject = !!currentProjectPath;

  const handleSaveAsCopy = async () => {
    setCopyingProject(true);
    try {
      const api = (window as unknown as { electronAPI?: {
        selectDirectory?: () => Promise<string | null>;
        copyProject?: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>;
      } }).electronAPI;
      if (!api?.selectDirectory || !api?.copyProject || !currentProjectPath) return;
      const destPath = await api.selectDirectory();
      if (!destPath) return;
      await onSaveAsCopy();
      const result = await api.copyProject(currentProjectPath, destPath);
      if (!result.success) {
        console.warn('Copy failed:', result.error);
      }
    } catch (e) {
      console.warn('Save as copy failed', e);
    } finally {
      setCopyingProject(false);
    }
  };

  type MenuItem = {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    separator?: boolean;
    loading?: boolean;
    variant?: 'default' | 'danger' | 'muted';
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Save & Quit Project',
      icon: <Save className="w-3 h-3" />,
      onClick: async () => {
        setSavingAndQuitting(true);
        try { await onSaveAndQuit(); } finally { setSavingAndQuitting(false); }
      },
      loading: savingAndQuitting,
      disabled: !hasProject
    },
    {
      label: 'Quit Project',
      icon: <LogOut className="w-3 h-3" />,
      onClick: () => setConfirmQuit(true),
      variant: 'danger',
      disabled: !hasProject
    },
    { label: '', icon: null, onClick: () => {}, separator: true },
    {
      label: 'Show Project Folder',
      icon: <FolderOpen className="w-3 h-3" />,
      onClick: onShowProjectFolder,
      disabled: !hasProject
    },
    {
      label: 'Save Project as a Copy',
      icon: <Copy className="w-3 h-3" />,
      onClick: handleSaveAsCopy,
      loading: copyingProject,
      disabled: !hasProject
    },
    { label: '', icon: null, onClick: () => {}, separator: true },
    {
      label: 'Help & Documentation',
      icon: <HelpCircle className="w-3 h-3" />,
      onClick: onShowHelp
    },
    {
      label: 'Export Project',
      icon: <Package className="w-3 h-3" />,
      onClick: onExport,
      variant: 'muted'
    },
    {
      label: 'Check for Updates',
      icon: <RefreshCw className="w-3 h-3" />,
      onClick: onCheckUpdates,
      variant: 'muted'
    },
    { label: '', icon: null, onClick: () => {}, separator: true },
    {
      label: 'Restart Flare Studio',
      icon: <RotateCcw className="w-3 h-3" />,
      onClick: onRestart
    }
  ];

  return createPortal(
    <div
      ref={menuRef}
      style={{
        left: anchorPos.left,
        top: anchorPos.top,
        position: 'fixed',
        transform: 'translateY(-100%)'
      }}
      className="w-44 bg-background border border-border rounded-md shadow-lg z-[9999] py-0.5"
    >
      {confirmQuit ? (
        <div className="px-3 py-2.5">
          <p className="text-xs text-foreground mb-2">Quit without saving?</p>
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setConfirmQuit(false)}
              className="px-2.5 py-1 text-[11px] rounded border border-border bg-background hover:bg-gray-100 dark:hover:bg-neutral-800 text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmQuit(false); onQuit(); }}
              className="px-2.5 py-1 text-[11px] rounded bg-red-600 hover:bg-red-700 text-white"
            >
              Quit
            </button>
          </div>
        </div>
      ) : (
        <div className="py-0.5">
          {menuItems.map((item, i) => {
            if (item.separator) {
              return <div key={`sep-${i}`} className="border-t border-border my-0.5" />;
            }

            const isDisabled = item.disabled || item.loading;
            const textColor =
              item.variant === 'danger'
                ? 'text-red-600 dark:text-red-400'
                : item.variant === 'muted'
                  ? 'text-muted-foreground'
                  : 'text-foreground';

            return (
              <button
                key={item.label}
                className={`w-full text-left px-2.5 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-100 dark:hover:bg-neutral-800'
                } ${textColor}`}
                onClick={isDisabled ? undefined : item.onClick}
                disabled={isDisabled}
              >
                {item.loading ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> : <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
};

export default MainMenuDialog;
