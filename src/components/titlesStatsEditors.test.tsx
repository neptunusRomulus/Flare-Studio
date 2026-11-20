import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import SidebarTitlesArea from './SidebarTitlesArea';
import SidebarStatsArea from './SidebarStatsArea';

describe('Titles and Stats rail editors', () => {
  it('renders empty-state copy when no project is open', () => {
    const titles = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><SidebarTitlesArea /></AppProvider>);
    expect(titles).toContain('Titles');
    expect(titles).toContain('Add title');
    expect(titles).toContain('Open a project to edit titles.');

    const stats = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><SidebarStatsArea /></AppProvider>);
    expect(stats).toContain('Stats');
    expect(stats).toContain('Open a project to edit stats.');
    expect(stats).toContain('Primary stats can be added');
  });
});
