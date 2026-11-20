import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import useAssembledSidebar from '@/hooks/useAssembledSidebar';
import SidebarGameSettingsArea from './SidebarGameSettingsArea';

function Probe({ deps }: { deps: Record<string, unknown> }) {
  const sb = useAssembledSidebar(deps) as Record<string, unknown>;
  return <pre>{JSON.stringify(sb.gameSettings ?? null)}</pre>;
}

describe('UI Settings dock panel', () => {
  it('keeps the Game Settings flag through sidebar assembly', () => {
    const html = renderToStaticMarkup(<Probe deps={{ gameSettings: { isGameSettingsLayer: true } }} />);
    expect(html).toContain('isGameSettingsLayer&quot;:true');
  });

  it('shows the tile size form instead of the tileset palette', () => {
    const html = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><SidebarGameSettingsArea /></AppProvider>);
    expect(html).toContain('High Res');
    expect(html).not.toContain('No tileset loaded');
  });

  it('is labeled UI Settings and no longer hosts the World editors', () => {
    const html = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><SidebarGameSettingsArea /></AppProvider>);
    expect(html).toContain('UI Settings');
    expect(html).not.toContain('Game Settings');
    expect(html).not.toContain('Cutscene');
    expect(html).not.toContain('Language catalog');
    expect(html).not.toContain('Parallax');
    expect(html).not.toContain('Fog of war');
    expect(html).not.toContain('Procedural rules');
  });
});
