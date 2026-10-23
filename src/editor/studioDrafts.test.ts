import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportMapText, validateText } from '../adapters/flare/flareAdapter.cjs';
import {
  collectTranslatableStrings,
  cutsceneFiles,
  fogFiles,
  mapHeaderForExport,
  msgidsFromPot,
  normalizeTileDraft,
  parallaxFiles,
  potFiles,
  procgenFiles,
  tileFiles,
} from './studioDrafts';

const fixture = (name: string) => readFileSync(new URL(`../../tests/fixtures/export/${name}`, import.meta.url), 'utf8');

describe('studio draft writers', () => {
  it('writes a chosen tile size instead of the 64 default', () => {
    const files = tileFiles('{"schemaVersion":1,"tile":{"width":64,"height":32,"orientation":"isometric"}}\n', {
      width: 96,
      height: 48,
      orientation: 'orthogonal',
    });
    const tileset = files.find((file) => file.path === 'engine/tileset_config.txt');
    const index = files.find((file) => file.path === 'project.json');
    expect(tileset?.content).toBe('APPEND\ntile_size=96,48\norientation=orthogonal\n');
    expect(validateText('tileset_config', tileset?.content || '')).toEqual([]);
    expect(JSON.parse(index?.content || '{}').tile).toEqual({ width: 96, height: 48, orientation: 'orthogonal' });
    expect(normalizeTileDraft({ width: 0, height: -1, orientation: 'nope' })).toEqual({
      width: 64,
      height: 32,
      orientation: 'isometric',
    });
  });

  it('writes a cutscene canonical file and the engine txt', () => {
    const files = cutsceneFiles('intro', {
      caption_margins: '10,10',
      music: 'music/intro.ogg',
      scenes: [{ caption: 'Hello', image: 'images/intro.png,2', pause: '2s' }],
      vscroll: [{ text: 'The end', image: 'images/credits.png', separator: '8' }],
    });
    expect(files[0].content).toBe(fixture('intro.cutscene.txt'));
    expect(validateText('cutscenes', files[0].content)).toEqual([]);
    expect(JSON.parse(files[1].content).kind).toBe('cutscene');
  });

  it('writes a deduped language catalog', () => {
    const scanned = collectTranslatableStrings({
      name: 'Find the Key',
      description: 'Find the cellar key.',
      nested: { title: 'Find the Key', ignored: 'skip' },
    });
    const files = potFiles(scanned);
    expect(files[0].content).toBe(fixture('project.pot'));
    expect(msgidsFromPot(files[0].content)).toEqual(['Find the Key', 'Find the cellar key.']);
    expect(JSON.parse(files[1].content).kind).toBe('language-catalog');
  });

  it('writes a parallax layer file', () => {
    const files = parallaxFiles('sky', [{ image: 'images/sky.png', speed: '0.2', map_layer: 'background' }]);
    expect(files[0].path).toBe('maps/parallax/sky.txt');
    expect(files[0].content).toBe(fixture('sky.parallax.txt'));
    expect(validateText('parallax', files[0].content)).toEqual([]);
  });

  it('writes a fog mask and keeps map fog keys on the header', () => {
    const files = fogFiles({
      radius: '4',
      bits_per_tile: '4',
      bits: ['BIT_0,0', 'BIT_N,1'],
      tiles: ['ALL,BIT_0,BIT_N'],
      data: 'ALL,ALL\nALL,ALL',
    });
    expect(files[0].content).toBe(fixture('mask.fow.txt'));
    expect(validateText('fog', files[0].content)).toEqual([]);
    const exported = exportMapText({
      width: 2,
      height: 2,
      heroX: 0,
      heroY: 0,
      layers: [],
      ...mapHeaderForExport({
        parallax: 'maps/parallax/sky.txt',
        fogofwar: '1',
        save_fogofwar: 'true',
        procgen_type: 'start',
        procgen_unique_status: 'placed',
        procgen_reset_status: 'reset',
      }),
    });
    expect(exported.text).toContain('parallax_layers=maps/parallax/sky.txt');
    expect(exported.text).toContain('fogofwar=1');
    expect(exported.text).toContain('save_fogofwar=true');
    expect(exported.text).toContain('procgen_type=start');
    expect(exported.text).not.toContain('procgen_chunks');
    expect(exported.errors).toEqual([]);
  });

  it('writes procedural rules without a procgen_chunks key', () => {
    const files = procgenFiles('dungeon', {
      doors_max: '3',
      main_path_length_min: '4',
      main_path_length_max: '8',
      chunks: ['maps/chunks/start.txt', 'maps/chunks/hall.txt'],
    });
    expect(files[0].content).toBe(fixture('dungeon.procgen.txt'));
    expect(validateText('procgen', files[0].content)).toEqual([]);
    expect(files[0].content).not.toContain('procgen_chunks');
  });
});
