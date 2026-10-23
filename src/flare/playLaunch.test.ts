import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dataPathFromFlareSelection } from './playLaunch';

const require = createRequire(import.meta.url);
const flare = require('../../electron/flareLaunch.cjs');

describe('data path from the selected Flare executable', () => {
  const samples = [
    'C:/Flare/flare.exe',
    'C:\\Flare\\flare.exe',
    '/usr/games/flare',
    '/home/user/flare-game',
    '/home/user/flare-game/',
    '',
  ];

  it('matches the main-process helper', () => {
    for (const sample of samples) {
      expect(dataPathFromFlareSelection(sample)).toBe(flare.dataPathFromFlareSelection(sample));
    }
  });

  it('uses the executable directory, not its parent', () => {
    expect(dataPathFromFlareSelection('C:/Flare/flare.exe')).toBe('C:/Flare');
    expect(dataPathFromFlareSelection('/opt/flare/flare')).toBe('/opt/flare');
  });

  it('keeps a legacy install folder instead of walking up', () => {
    expect(dataPathFromFlareSelection('/home/user/flare-game')).toBe('/home/user/flare-game');
  });
});

describe('Flare launch arguments', () => {
  it('builds --data-path, --mods and --load-slot and never --map', () => {
    const args = flare.buildFlareArgs({
      dataPath: '/opt/flare',
      mods: ['fantasycore', 'my_mod'],
      loadSlot: 1,
    });
    expect(args).toEqual([
      '--data-path=/opt/flare',
      '--mods=fantasycore,my_mod',
      '--load-slot=1',
    ]);
    expect(args.join(' ')).not.toContain('--map');
  });

  it('omits empty mods and load slot', () => {
    expect(flare.buildFlareArgs({ dataPath: '/opt/flare', mods: [], loadSlot: '' })).toEqual([
      '--data-path=/opt/flare',
    ]);
  });
});

describe('executable resolution', () => {
  it('treats a file as the executable and its directory as cwd', () => {
    const target = flare.resolveFlareLaunchTarget('/opt/flare/flare', {
      platform: 'linux',
      exists: (p: string) => p === '/opt/flare/flare' || p === '/opt/flare/mods',
      isDirectory: (p: string) => p === '/opt/flare/mods',
    });
    expect(target).toMatchObject({
      exePath: '/opt/flare/flare',
      dataPath: '/opt/flare',
      cwd: '/opt/flare',
      passDataPath: true,
    });
  });

  it('omits --data-path when the executable directory has no mods folder', () => {
    const target = flare.resolveFlareLaunchTarget('/usr/games/flare', {
      platform: 'linux',
      exists: (p: string) => p === '/usr/games/flare',
      isDirectory: () => false,
    });
    expect(target.cwd).toBe('/usr/games');
    expect(target.passDataPath).toBe(false);
  });

  it('finds flare.exe inside a legacy folder and keeps that folder as cwd', () => {
    const folder = path.join('/games', 'Flare');
    const target = flare.resolveFlareLaunchTarget(folder, {
      platform: 'win32',
      exists: (candidate: string) => candidate === folder || candidate.endsWith(`${path.sep}flare.exe`),
      isDirectory: (candidate: string) => candidate === folder,
    });
    expect(target.exePath.endsWith(`${path.sep}flare.exe`)).toBe(true);
    expect(target.dataPath).toBe(folder);
    expect(target.cwd).toBe(folder);
  });

  it('rejects a folder that does not contain the executable', () => {
    const target = flare.resolveFlareLaunchTarget('/opt/empty', {
      platform: 'linux',
      exists: () => true,
      isDirectory: () => true,
    });
    expect(target.error).toMatch(/folder/i);
  });
});

describe('path_user', () => {
  it('follows the Linux XDG then HOME then ./userdata order', () => {
    expect(flare.resolvePathUser('linux', { XDG_DATA_HOME: '/tmp/xdg' })).toBe('/tmp/xdg/flare');
    expect(flare.resolvePathUser('linux', { HOME: '/home/ismet' })).toBe('/home/ismet/.local/share/flare');
    expect(flare.resolvePathUser('linux', {}, '/work')).toBe('/work/userdata');
  });

  it('follows the Windows APPDATA\\flare\\userdata layout', () => {
    expect(flare.resolvePathUser('win32', { APPDATA: 'C:\\Users\\ismet\\AppData\\Roaming' })).toBe(
      'C:\\Users\\ismet\\AppData\\Roaming\\flare\\userdata'
    );
    expect(flare.resolvePathUser('win32', {}, 'D:\\flare')).toBe('D:\\flare\\userdata');
  });
});

describe('mod list from settings.txt requires=', () => {
  it('parses version constraints and ignores comments and default', () => {
    const text = [
      '# comment',
      'description=My mod',
      'requires=fantasycore:0.1:2.0, empyrean_campaign',
      'requires=default,alpha',
    ].join('\n');
    expect(flare.parseRequires(text)).toEqual(['fantasycore', 'empyrean_campaign', 'alpha']);
  });

  it('puts the project last and does not hardcode fantasycore', () => {
    expect(flare.buildModList(['fantasycore'], 'village')).toEqual(['fantasycore', 'village']);
    expect(flare.buildModList([], 'village')).toEqual(['village']);
    expect(flare.buildModList(flare.parseRequires('game=flare-game\n'), 'village')).toEqual(['village']);
  });

  it('reports dependencies that are not on disk', () => {
    const missing = flare.findMissingMods(['fantasycore', 'village'], {
      pathUser: '/home/ismet/.local/share/flare',
      dataPath: '/opt/flare',
      projectModName: 'village',
      exists: (p: string) => p === '/opt/flare/mods' || p === '/opt/flare/mods/fantasycore',
    });
    expect(missing).toEqual([]);
    const absent = flare.findMissingMods(['fantasycore', 'village'], {
      pathUser: '/home/ismet/.local/share/flare',
      dataPath: '/opt/flare',
      projectModName: 'village',
      exists: (p: string) => p === '/opt/flare/mods' || p === '/home/ismet/.local/share/flare/mods',
    });
    expect(absent).toEqual(['fantasycore']);
    const unknownLayout = flare.findMissingMods(['fantasycore', 'village'], {
      pathUser: '/home/ismet/.local/share/flare',
      dataPath: '/usr/games',
      projectModName: 'village',
      exists: () => false,
    });
    expect(unknownLayout).toEqual([]);
  });

  it('finds a distro mod under /usr/share/flare when --data-path is omitted', () => {
    const found = flare.findMissingMods(['fantasycore', 'village'], {
      pathUser: '/home/ismet/.local/share/flare',
      dataPath: '/usr/games',
      cwd: '/usr/games',
      passDataPath: false,
      platform: 'linux',
      projectModName: 'village',
      exists: (p: string) =>
        p === '/usr/share/flare' ||
        p === '/usr/share/flare/mods' ||
        p === '/usr/share/flare/mods/fantasycore' ||
        p === '/home/ismet/.local/share/flare/mods',
    });
    expect(found).toEqual([]);
  });

  it('stops at the first Linux data root, matching PlatformLinux::setPaths', () => {
    const missing = flare.findMissingMods(['fantasycore'], {
      pathUser: '/home/ismet/.local/share/flare',
      cwd: '/usr/games',
      passDataPath: false,
      platform: 'linux',
      projectModName: 'village',
      exists: (p: string) =>
        p === '/usr/local/share/flare' ||
        p === '/usr/local/share/flare/mods' ||
        p === '/usr/share/flare/mods/fantasycore' ||
        p === '/home/ismet/.local/share/flare/mods',
    });
    expect(missing).toEqual(['fantasycore']);
  });
});

describe('settings.txt generation', () => {
  it('creates description, version and game from the project name', () => {
    const plan = flare.planSettingsWrite(null, 'My Village');
    expect(plan.write).toBe(true);
    expect(plan.content).toContain('description=My Village');
    expect(plan.content).toContain('version=1.0');
    expect(plan.content).toContain('game=flare-game');
    expect(plan.content).not.toContain('Town');
  });

  it('does not rewrite an existing file on export', () => {
    const existing = 'description=Kept\ngame=my-game\nversion=2.0\nrequires=fantasycore\nengine_version_min=1.13.01\n';
    const plan = flare.planSettingsWrite(existing, 'Map Name That Must Not Win');
    expect(plan.write).toBe(false);
    expect(plan.content).toBe(existing);
  });

  it('only appends keys that are missing', () => {
    const plan = flare.planSettingsWrite('description=Kept\n', 'Ignored');
    expect(plan.write).toBe(true);
    expect(plan.content.startsWith('description=Kept\n')).toBe(true);
    expect(plan.content).toContain('version=1.0');
    expect(plan.content).toContain('game=flare-game');
    expect(plan.content).not.toContain('description=Ignored');
  });
});

describe('engine gameplay.txt and misc.txt', () => {
  it('writes APPEND enable_playgame=1 into an empty file and updates 0 in place', () => {
    expect(flare.upsertKey('', 'enable_playgame', '1')).toBe('APPEND\nenable_playgame=1\n');
    const updated = flare.upsertKey('mouse_move_enabled=true\nenable_playgame=0\n', 'enable_playgame', '1');
    expect(updated).toBe('mouse_move_enabled=true\nenable_playgame=1\n');
  });

  it('keeps an existing save_prefix and fills one in when missing', () => {
    const kept = flare.ensureSavePrefix('save_prefix=campaign\n', 'studio_other');
    expect(kept.changed).toBe(false);
    expect(kept.prefix).toBe('campaign');

    const filled = flare.ensureSavePrefix('window_title=Hi\n', 'studio_village');
    expect(filled.changed).toBe(true);
    expect(filled.content).toContain('window_title=Hi');
    expect(filled.content).toContain('save_prefix=studio_village');
    expect(filled.prefix).toBe('studio_village');
  });

  it('uses a distinct playtest prefix so player saves are not reused', () => {
    expect(flare.slugSavePrefix('My Village')).toBe('studio_my_village');
    expect(flare.playtestPrefix('studio_my_village')).toBe('studio_my_village_playtest');
    expect(flare.playtestPrefix('studio_my_village')).not.toBe('studio_my_village');
  });
});

describe('--load-slot index', () => {
  it('uses the numeric position, not the folder number', () => {
    expect(flare.loadSlotIndex(['1'], '1')).toBe(1);
    expect(flare.loadSlotIndex(['10', '2', '1'], '10')).toBe(3);
    expect(flare.loadSlotIndex(['1', '3'], '3')).toBe(2);
  });

  it('drops non-numeric names and ignores lexicographic order', () => {
    expect(flare.loadSlotNames(['notes', '10', '2', '0', '1'])).toEqual(['1', '2', '10']);
    expect(flare.loadSlotIndex(['notes', '10', '2'], '2')).toBe(1);
    expect(flare.loadSlotIndex(['1', '2'], '9')).toBeNull();
  });

  it('parses integers the way Parse::toInt does', () => {
    expect(flare.toIntFlare('10')).toBe(10);
    expect(flare.toIntFlare('  3')).toBe(3);
    expect(flare.toIntFlare('foo')).toBe(0);
    expect(flare.toIntFlare('8abc')).toBe(8);
  });
});

describe('quick-launch avatar and map paths', () => {
  it('reads hero_pos and intermap', () => {
    expect(flare.parseHeroPos('[header]\nhero_pos=4,9\n')).toEqual({ x: 4, y: 9 });
    expect(flare.parseIntermap('intermap=maps/town.txt,3,8\n')).toEqual({
      map: 'maps/town.txt',
      x: 3,
      y: 8,
    });
  });

  it('sanitizes map names the same way export writes the file', () => {
    expect(flare.sanitizeMapFileName('Town Map')).toBe('town_map');
    expect(flare.sanitizeMapFileName('ışık')).toBe('isik');
    expect(flare.candidateMapRelatives('Town Map')).toEqual([
      'maps/town_map.txt',
      'maps/Town_Map.txt',
    ]);
  });

  it('writes a spawn line the engine can teleport with', () => {
    const text = flare.buildAvatarText({
      name: 'StudioTest',
      className: 'Wanderer',
      mapPath: 'maps/Town_Map.txt',
      x: 4,
      y: 9,
    });
    expect(text).toContain('name=StudioTest');
    expect(text).toContain('class=Wanderer');
    expect(text).toContain('spawn=maps/Town_Map.txt,4,9');
    expect(text.startsWith('## flare-engine save file ##')).toBe(true);
  });

  it('reads the first [class] name', () => {
    const text = '# comment\n[class]\nname=Wanderer\ndescription=x\n';
    expect(flare.firstHeroClassName(text)).toBe('Wanderer');
    expect(flare.firstHeroClassName('')).toBe('');
  });
});

describe('mod link', () => {
  it('symlinks the project into path_user/mods and does not delete a real folder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-link-'));
    const project = path.join(root, 'village');
    const user = path.join(root, 'userdata');
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, 'settings.txt'), 'description=village\n', 'utf8');

    const created = flare.linkProjectMod(project, user);
    expect(created.success).toBe(true);
    expect(created.junctionCreated).toBe(true);
    expect(fs.realpathSync(created.linkPath)).toBe(fs.realpathSync(project));

    const again = flare.linkProjectMod(project, user);
    expect(again.success).toBe(true);
    expect(again.junctionCreated).toBe(false);

    const blocker = path.join(root, 'userdata-real');
    const realMods = path.join(blocker, 'mods', 'taken');
    fs.mkdirSync(realMods, { recursive: true });
    fs.writeFileSync(path.join(realMods, 'keep.txt'), 'safe', 'utf8');
    const blocked = flare.linkProjectMod(project, blocker);
    // project basename is village, not taken, so this still links village
    expect(blocked.success).toBe(true);
    expect(fs.existsSync(path.join(realMods, 'keep.txt'))).toBe(true);

    const occupied = path.join(root, 'occupied-user');
    const occupiedMods = path.join(occupied, 'mods');
    fs.mkdirSync(path.join(occupiedMods, 'village'), { recursive: true });
    fs.writeFileSync(path.join(occupiedMods, 'village', 'keep.txt'), 'safe', 'utf8');
    const refused = flare.linkProjectMod(project, occupied);
    expect(refused.success).toBe(false);
    expect(fs.readFileSync(path.join(occupiedMods, 'village', 'keep.txt'), 'utf8')).toBe('safe');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
