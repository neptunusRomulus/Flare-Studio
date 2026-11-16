export type TabCycleDirection = 1 | -1;

export function nextEditorTabId(
  tabs: Array<{ id: string }>,
  activeTabId: string | null,
  direction: TabCycleDirection,
): string | null {
  if (tabs.length < 2) return null;
  const index = tabs.findIndex((tab) => tab.id === activeTabId);
  const from = index === -1 ? 0 : index;
  const next = tabs[(from + direction + tabs.length) % tabs.length];
  return next && next.id !== activeTabId ? next.id : null;
}

export function isTypingOrDialogTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editable = target.getAttribute('contenteditable');
  if (target.isContentEditable || editable === '' || editable === 'true') return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('[role="dialog"], [role="alertdialog"]'));
}

/** Ctrl+Tab = next, Ctrl+Shift+Tab = previous. Meta/Alt are ignored so OS app-switching stays intact. */
export function matchEditorTabCycleShortcut(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): TabCycleDirection | null {
  if (event.key !== 'Tab') return null;
  if (!event.ctrlKey || event.metaKey || event.altKey) return null;
  return event.shiftKey ? -1 : 1;
}
