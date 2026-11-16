// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  isTypingOrDialogTarget,
  matchEditorTabCycleShortcut,
  nextEditorTabId,
} from './tabCycle';

const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('nextEditorTabId', () => {
  it('moves forward and wraps', () => {
    expect(nextEditorTabId(tabs, 'a', 1)).toBe('b');
    expect(nextEditorTabId(tabs, 'c', 1)).toBe('a');
  });

  it('moves backward and wraps', () => {
    expect(nextEditorTabId(tabs, 'b', -1)).toBe('a');
    expect(nextEditorTabId(tabs, 'a', -1)).toBe('c');
  });

  it('does nothing with fewer than two tabs', () => {
    expect(nextEditorTabId([], 'a', 1)).toBeNull();
    expect(nextEditorTabId([{ id: 'a' }], 'a', 1)).toBeNull();
  });

  it('starts at the first tab when the active id is missing', () => {
    expect(nextEditorTabId(tabs, null, 1)).toBe('b');
    expect(nextEditorTabId(tabs, 'missing', -1)).toBe('c');
  });
});

describe('matchEditorTabCycleShortcut', () => {
  it('maps Ctrl+Tab and Ctrl+Shift+Tab', () => {
    expect(matchEditorTabCycleShortcut({ key: 'Tab', ctrlKey: true })).toBe(1);
    expect(matchEditorTabCycleShortcut({ key: 'Tab', ctrlKey: true, shiftKey: true })).toBe(-1);
  });

  it('ignores Tab without Ctrl, and Ctrl+Tab with Alt or Meta', () => {
    expect(matchEditorTabCycleShortcut({ key: 'Tab' })).toBeNull();
    expect(matchEditorTabCycleShortcut({ key: 'Tab', shiftKey: true })).toBeNull();
    expect(matchEditorTabCycleShortcut({ key: 'Tab', ctrlKey: true, altKey: true })).toBeNull();
    expect(matchEditorTabCycleShortcut({ key: 'Tab', ctrlKey: true, metaKey: true })).toBeNull();
    expect(matchEditorTabCycleShortcut({ key: 'Tab', metaKey: true })).toBeNull();
    expect(matchEditorTabCycleShortcut({ key: 's', ctrlKey: true })).toBeNull();
  });
});

describe('isTypingOrDialogTarget', () => {
  it('treats inputs, textareas, selects, and contenteditable as typing', () => {
    for (const tag of ['input', 'textarea', 'select'] as const) {
      expect(isTypingOrDialogTarget(document.createElement(tag))).toBe(true);
    }
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    expect(isTypingOrDialogTarget(editable)).toBe(true);
    editable.remove();
    expect(isTypingOrDialogTarget(document.createElement('button'))).toBe(false);
    expect(isTypingOrDialogTarget(null)).toBe(false);
  });

  it('treats focus inside a dialog as blocked', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    expect(isTypingOrDialogTarget(button)).toBe(true);
    expect(isTypingOrDialogTarget(dialog)).toBe(true);
    dialog.remove();
  });
});
