import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import {
  CutsceneEditor,
  FogEditor,
  LanguagePotEditor,
  MapPresentationFields,
  ParallaxEditor,
  ProcgenEditor,
  StudioWorldPanel,
  TileSizeForm,
} from './studioEditors';
import { emptyMapPresentation } from '@/editor/studioDrafts';

function render(node: React.ReactNode) {
  return renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}>{node}</AppProvider>);
}

describe('studio editor screens', () => {
  it('renders an editable tile size instead of a fixed 64 label', () => {
    const html = render(<TileSizeForm />);
    expect(html).toContain('Tile size');
    expect(html).toContain('Tile width');
    expect(html).toContain('value="64"');
    expect(html).toContain('value="32"');
    expect(html).toContain('orthogonal');
    expect(html).toContain('Write tileset config');
    expect(html).not.toContain('not user-configurable');
  });

  it('renders the cutscene editor', () => {
    const html = render(<CutsceneEditor />);
    expect(html).toContain('Cutscene');
    expect(html).toContain('Write cutscene');
    expect(html).toContain('Add scene');
    expect(html).toContain('Add vscroll');
  });

  it('renders the language catalog editor', () => {
    const html = render(<LanguagePotEditor />);
    expect(html).toContain('Language catalog');
    expect(html).toContain('Scan project');
    expect(html).toContain('Write catalog');
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
    expect(html).toContain('Write rules');
    expect(html).toContain('doors_max');
    expect(html).toContain('procgen_filename');
    expect(html).not.toContain('procgen_chunks');
  });

  it('renders map header fields and the world panel', () => {
    const fields = render(
      <MapPresentationFields value={emptyMapPresentation()} onChange={() => undefined} />
    );
    expect(fields).toContain('Parallax layers');
    expect(fields).toContain('Procgen type');
    expect(fields).toContain('door_west_east');
    const panel = render(<StudioWorldPanel />);
    expect(panel).toContain('Cutscene');
    expect(panel).toContain('Language catalog');
    expect(panel).toContain('Parallax');
    expect(panel).toContain('Fog of war');
    expect(panel).toContain('Procedural rules');
  });
});
