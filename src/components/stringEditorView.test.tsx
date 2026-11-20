import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import SidebarStringsArea from './SidebarStringsArea';
import StringEditorView from './StringEditorView';

describe('Localization editor', () => {
  it('renders the wide-panel editor when no project is open', () => {
    const html = renderToStaticMarkup(
      <AppProvider value={{ currentProjectPath: null }}>
        <div className="flex flex-col h-96">
          <SidebarStringsArea />
        </div>
      </AppProvider>,
    );
    expect(html).toContain('Localization');
    expect(html).toContain('Back to UI Settings');
    expect(html).toContain('Add language');
    expect(html).toContain('Open a project to edit strings.');
    expect(html).toContain('engine.*.po');
  });

  it('keeps the source-language empty state in the view itself', () => {
    const html = renderToStaticMarkup(<StringEditorView projectPath={null} />);
    expect(html).toContain('Open a project to edit strings.');
  });
});
