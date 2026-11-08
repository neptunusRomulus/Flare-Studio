import { describe, it, expect } from 'vitest';
import { shouldCreatePreMapEditor, shouldShowPanels } from './preMapEditor';

const base = { hasEditor: false, canvasMounted: true, showWelcome: false, isOpeningProject: false, hasPendingMapConfig: false, mapInitialized: false, projectPath: '/p' };

describe('pre-map editor', () => {
  it('creates an editor for a freshly created empty project', () => {
    expect(shouldCreatePreMapEditor(base)).toBe(true);
  });
  it('does not interfere with loading existing maps or the welcome screen', () => {
    expect(shouldCreatePreMapEditor({ ...base, isOpeningProject: true })).toBe(false);
    expect(shouldCreatePreMapEditor({ ...base, hasPendingMapConfig: true })).toBe(false);
    expect(shouldCreatePreMapEditor({ ...base, mapInitialized: true })).toBe(false);
    expect(shouldCreatePreMapEditor({ ...base, showWelcome: true })).toBe(false);
    expect(shouldCreatePreMapEditor({ ...base, hasEditor: true })).toBe(false);
    expect(shouldCreatePreMapEditor({ ...base, projectPath: null })).toBe(false);
  });
  it('panels show once the pre-map editor exists', () => {
    expect(shouldShowPanels({ hasMap: false, hasEditor: false, projectPath: '/p' })).toBe(false);
    expect(shouldShowPanels({ hasMap: false, hasEditor: true, projectPath: '/p' })).toBe(true);
  });
});
