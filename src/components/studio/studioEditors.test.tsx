import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import {
  CutsceneEditor,
  FogEditor,
  MapPresentationFields,
  ParallaxEditor,
  ProcgenEditor,
  PROCGEN_TYPES,
  StudioWorldPanel,
  TileSizeForm,
} from './studioEditors';
import { emptyMapPresentation } from '@/editor/studioDrafts';

function render(node: React.ReactNode) {
  return renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}>{node}</AppProvider>);
}

describe('studio editor screens', () => {
  it('renders a project-wide tile size with presets and custom orientation/size', () => {
    const html = render(<TileSizeForm />);
    expect(html).toContain('Tile Size');
    expect(html).toContain('Low Res');
    expect(html).toContain('High Res');
    expect(html).toContain('Tile orientation');
    expect(html).toContain('Tile width');
    expect(html).toContain('Apply custom size');
    expect(html).toContain('type="number"');
    expect(html).not.toContain('Are you sure?');
  });

  it('renders the cutscene editor', () => {
    const html = render(<CutsceneEditor />);
    expect(html).toContain('Cutscenes');
    expect(html).toContain('No cutscene files in cutscenes/ yet.');
  });

  it('renders the parallax editor', () => {
    const html = render(<ParallaxEditor />);
    expect(html).toContain('Parallax');
    expect(html).toContain('Write parallax');
    expect(html).toContain('map_layer');
  });

  it('renders the fog of war editor', () => {
    const html = render(<FogEditor />);
    expect(html).toContain('Fog of war');
    expect(html).toContain('Write fog mask');
    expect(html).toContain('Map fogofwar');
    expect(html).toContain('Map save_fogofwar');
  });

  it('renders the procgen rules editor', () => {
    const html = render(<ProcgenEditor />);
    expect(html).toContain('Procedural rules');
    expect(html).toContain('No procgen rule files in maps/procgen_rules/ yet.');
    expect(html).toContain('data-studio-hint');
    expect(html).not.toContain('Write rules');
    expect(html).not.toContain('procgen_chunks');
  });

  it('renders map header fields and the world panel', () => {
    const fields = render(
      <MapPresentationFields value={emptyMapPresentation()} onChange={() => undefined} />
    );
    expect(fields).toContain('Parallax layers');
    expect(fields).toContain('Procgen type');
    // Radix Select options are not in static markup; the catalog still includes the door types.
    expect(PROCGEN_TYPES).toContain('door_west_east');
    const panel = render(<StudioWorldPanel />);
    expect(panel).toContain('Cutscene');
    expect(panel).toContain('Parallax');
    expect(panel).toContain('Fog of war');
    expect(panel).toContain('Procedural rules');
  });
});
