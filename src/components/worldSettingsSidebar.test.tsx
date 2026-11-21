import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import SidebarWorldSettingsArea from './SidebarWorldSettingsArea';

describe('World Settings dock panel', () => {
  it('mounts the World editors in their own rail card', () => {
    const html = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><SidebarWorldSettingsArea /></AppProvider>);
    expect(html).toContain('World Settings');
    expect(html).toContain('Cutscene');
    expect(html).toContain('Parallax');
    expect(html).toContain('Fog of war');
    expect(html).toContain('Procedural rules');
    expect(html).toContain('No cutscene files in cutscenes/ yet.');
    expect(html).toContain('Write parallax');
    expect(html).toContain('Write fog mask');
    expect(html).toContain('No procgen rule files in maps/procgen_rules/ yet.');
    expect(html).not.toContain('Write rules');
  });
});
