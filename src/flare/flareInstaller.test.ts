import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { variantForFlarePath } from './flarePathStore';
import FlareInstallButtons from '@/components/FlareInstallButtons';

const require = createRequire(import.meta.url);
const installer = require('../../electron/flareInstaller.cjs');
const flare = require('../../electron/flareLaunch.cjs');

describe('Flare release assets', () => {
  it('builds the Linux AppImage URL per variant', () => {
    expect(installer.releaseAsset('modern', 'linux')).toMatchObject({
      tag: 'v1.15',
      kind: 'appimage',
      url: 'https://github.com/flareteam/flare-game/releases/download/v1.15/flare-linux64-v1.15.AppImage',
    });
    expect(installer.releaseAsset('classic', 'linux').url).toBe(
      'https://github.com/flareteam/flare-game/releases/download/v1.14/flare-linux64-v1.14.AppImage',
    );
  });

  it('describes the Windows zip but only Linux installs for now', () => {
    expect(installer.releaseAsset('classic', 'win32')).toMatchObject({ kind: 'zip', file: 'flare-win-v1.14.zip' });
    expect(installer.isInstallSupported('linux')).toBe(true);
    expect(installer.isInstallSupported('win32')).toBe(false);
    expect(installer.releaseAsset('modern', 'darwin').error).toMatch(/not supported/);
    expect(installer.releaseAsset('retro', 'linux').error).toMatch(/Unknown/);
  });

  it('refuses unsupported platforms without touching the network', async () => {
    const mac = await installer.installFlare('modern', { platform: 'darwin' });
    expect(mac.ok).toBe(false);
    const win = await installer.installFlare('modern', { platform: 'win32' });
    expect(win).toMatchObject({ ok: false });
    expect(win.error).toMatch(/Linux/);
  });
});

describe('install locations', () => {
  it('uses XDG data home, then ~/.local/share', () => {
    expect(installer.installRoot({ platform: 'linux', env: { XDG_DATA_HOME: '/x' }, homedir: '/home/u' })).toBe(
      '/x/flare-studio/engines',
    );
    expect(installer.installDirFor('classic', { platform: 'linux', env: {}, homedir: '/home/u' })).toBe(
      '/home/u/.local/share/flare-studio/engines/v1.14',
    );
  });

  it('maps the extracted AppImage layout', () => {
    expect(installer.extractedLayout('/e/v1.14')).toEqual({
      root: '/e/v1.14/squashfs-root',
      exePath: '/e/v1.14/squashfs-root/AppRun',
      dataPath: '/e/v1.14/squashfs-root/usr/share/flare',
    });
  });

  it('knows the variant and tile size of a saved path', () => {
    const classic = '/home/u/.local/share/flare-studio/engines/v1.14/squashfs-root/AppRun';
    const modern = '/home/u/.local/share/flare-studio/engines/v1.15/squashfs-root/AppRun';
    expect(installer.variantForFlarePath(classic)).toBe('classic');
    expect(variantForFlarePath(classic)).toBe('classic');
    expect(variantForFlarePath(modern)).toBe('modern');
    expect(variantForFlarePath('/home/u/flare-engine/flare')).toBeNull();
    expect(installer.tileForFlarePath(classic)).toEqual({ width: 64, height: 32 });
    expect(installer.tileForFlarePath(modern)).toEqual({ width: 192, height: 96 });
    expect(installer.tileForFlarePath(undefined)).toEqual({ width: 192, height: 96 });
  });

  it('reads the version from --version output', () => {
    expect(installer.parseFlareVersion('INFO: Flare 1.14 (Linux)')).toBe('1.14');
    expect(installer.parseFlareVersion('nothing')).toBe('');
  });
});

describe('extracted AppImage launch target', () => {
  const root = '/e/v1.14/squashfs-root';
  const files = new Set([
    `${root}/AppRun`,
    `${root}/usr/share/flare/mods`,
    `${root}/usr/share/flare/mods/default`,
    `${root}/usr/share/flare/mods/fantasycore`,
    '/home/u/.local/share/flare/mods',
  ]);
  const exists = (p: string) => files.has(p);

  it('runs AppRun with --data-path at usr/share/flare', () => {
    const target = flare.resolveFlareLaunchTarget(`${root}/AppRun`, { platform: 'linux', exists, isDirectory: () => false });
    expect(target).toEqual({
      exePath: `${root}/AppRun`,
      dataPath: `${root}/usr/share/flare`,
      cwd: root,
      passDataPath: true,
    });
    expect(flare.dataPathFromFlareSelection(`${root}/AppRun`)).toBe(root);
  });

  it('finds the bundled fantasycore for requires=', () => {
    const target = flare.resolveFlareLaunchTarget(`${root}/AppRun`, { platform: 'linux', exists, isDirectory: () => false });
    const missing = flare.findMissingMods(['fantasycore', 'my_mod'], {
      pathUser: '/home/u/.local/share/flare',
      dataPath: target.dataPath,
      cwd: target.cwd,
      passDataPath: target.passDataPath,
      platform: 'linux',
      env: {},
      projectModName: 'my_mod',
      exists,
    });
    expect(missing).toEqual([]);
  });
});

describe('download', () => {
  it('follows redirects, reports progress and renames the .part file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-dl-'));
    const dest = path.join(dir, 'f.AppImage');
    const body = Buffer.from('hello flare');
    const seen: string[] = [];
    const get = (url: string, _opts: unknown, cb: (res: unknown) => void) => {
      seen.push(url);
      const res = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> };
      if (seen.length === 1) {
        res.statusCode = 302;
        res.headers = { location: 'https://cdn.example/f' };
        setTimeout(() => { cb(res); res.end(); }, 0);
      } else {
        res.statusCode = 200;
        res.headers = { 'content-length': String(body.length) };
        setTimeout(() => { cb(res); res.end(body); }, 0);
      }
      return { on: () => {}, setTimeout: () => {} };
    };
    const progress: number[] = [];
    const result = await installer.downloadFile('https://github.com/x', dest, {
      get,
      onProgress: ({ received }: { received: number }) => progress.push(received),
    });
    expect(seen).toEqual(['https://github.com/x', 'https://cdn.example/f']);
    expect(result.size).toBe(body.length);
    expect(fs.readFileSync(dest, 'utf8')).toBe('hello flare');
    expect(fs.existsSync(`${dest}.part`)).toBe(false);
    expect(progress.at(-1)).toBe(body.length);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('removes the .part file on HTTP errors', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-dl-'));
    const dest = path.join(dir, 'f.AppImage');
    const get = (_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      const res = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> };
      res.statusCode = 404;
      res.headers = {};
      setTimeout(() => { cb(res); res.end(); }, 0);
      return { on: () => {}, setTimeout: () => {} };
    };
    await expect(installer.downloadFile('https://github.com/x', dest, { get })).rejects.toThrow(/404/);
    expect(fs.existsSync(`${dest}.part`)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Welcome screen install buttons', () => {
  it('shows only the two buttons, no spinner or extra text', () => {
    const html = renderToStaticMarkup(React.createElement(FlareInstallButtons));
    expect(html).toContain('Flare Modern');
    expect(html).toContain('Flare Classic');
    expect(html).not.toContain('flare-install-spinner');
    expect(html).not.toContain('Recommended');
  });
});
