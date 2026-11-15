import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MARKER_NAME, isMissingOrEmptyDir, migrateUserData } from '../../electron/migrateUserData.cjs';

const temps: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-userdata-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('migrateUserData', () => {
  it('copies the old directory into an missing new one and writes a marker, leaving the old files', () => {
    const root = tmpDir();
    const oldDir = path.join(root, 'ism-tile');
    const newDir = path.join(root, 'flare-studio');
    fs.mkdirSync(path.join(oldDir, 'Local Storage'), { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'display-settings.json'), '{"interfaceScale":110}\n');
    fs.writeFileSync(path.join(oldDir, 'Local Storage', 'file.ldb'), 'idb');

    const result = migrateUserData({ newDir, oldDir });

    expect(result.migrated).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(fs.readFileSync(path.join(newDir, 'display-settings.json'), 'utf8')).toBe('{"interfaceScale":110}\n');
    expect(fs.readFileSync(path.join(newDir, 'Local Storage', 'file.ldb'), 'utf8')).toBe('idb');
    expect(fs.existsSync(path.join(newDir, MARKER_NAME))).toBe(true);
    expect(fs.readFileSync(path.join(oldDir, 'display-settings.json'), 'utf8')).toBe('{"interfaceScale":110}\n');
  });

  it('skips when the new directory already has files', () => {
    const root = tmpDir();
    const oldDir = path.join(root, 'ism-tile');
    const newDir = path.join(root, 'flare-studio');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'old.json'), 'old');
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(newDir, 'display-settings.json'), 'new');

    const result = migrateUserData({ newDir, oldDir });

    expect(result).toMatchObject({ migrated: false, skipped: 'new-data-present' });
    expect(fs.readFileSync(path.join(newDir, 'display-settings.json'), 'utf8')).toBe('new');
    expect(fs.existsSync(path.join(newDir, MARKER_NAME))).toBe(false);
  });

  it('skips a second run once the marker exists', () => {
    const root = tmpDir();
    const oldDir = path.join(root, 'ism-tile');
    const newDir = path.join(root, 'flare-studio');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'a.json'), '1');
    expect(migrateUserData({ newDir, oldDir }).migrated).toBe(true);
    fs.writeFileSync(path.join(oldDir, 'b.json'), '2');

    const second = migrateUserData({ newDir, oldDir });

    expect(second).toMatchObject({ migrated: false, skipped: 'already-migrated' });
    expect(fs.existsSync(path.join(newDir, 'b.json'))).toBe(false);
  });

  it('skips when there is no old directory', () => {
    const root = tmpDir();
    const result = migrateUserData({
      newDir: path.join(root, 'flare-studio'),
      oldDir: path.join(root, 'ism-tile'),
    });
    expect(result).toMatchObject({ migrated: false, skipped: 'no-old-data' });
  });

  it('treats a missing directory as empty and an occupied one as not empty', () => {
    const root = tmpDir();
    expect(isMissingOrEmptyDir(path.join(root, 'missing'))).toBe(true);
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    expect(isMissingOrEmptyDir(empty)).toBe(true);
    fs.writeFileSync(path.join(empty, 'x'), 'x');
    expect(isMissingOrEmptyDir(empty)).toBe(false);
  });
});
