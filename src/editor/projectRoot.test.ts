import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPlausibleProjectRoot, isUsableProjectLocation } from './projectRoot.cjs';

function sandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flare-root-'));
}

describe('isPlausibleProjectRoot', () => {
  it('accepts a directory carrying a project marker', () => {
    const root = sandbox();
    fs.writeFileSync(path.join(root, 'project.json'), '{}');
    expect(isPlausibleProjectRoot(root)).toBe(true);
  });

  it('accepts a directory that only has map json files', () => {
    const root = sandbox();
    fs.mkdirSync(path.join(root, 'maps'));
    fs.writeFileSync(path.join(root, 'Town.json'), '{}');
    expect(isPlausibleProjectRoot(root)).toBe(true);
  });

  it('rejects the filesystem root and the home directory', () => {
    expect(isPlausibleProjectRoot(path.parse(process.cwd()).root)).toBe(false);
    expect(isPlausibleProjectRoot(os.homedir())).toBe(false);
  });

  it('rejects empty and markerless directories', () => {
    expect(isPlausibleProjectRoot(sandbox())).toBe(false);
    expect(isPlausibleProjectRoot(path.join(sandbox(), 'missing'))).toBe(false);
  });

  it('rejects a file and empty input', () => {
    const root = sandbox();
    const file = path.join(root, 'notes.txt');
    fs.writeFileSync(file, 'x');
    expect(isPlausibleProjectRoot(file)).toBe(false);
    expect(isPlausibleProjectRoot('')).toBe(false);
    expect(isPlausibleProjectRoot(null)).toBe(false);
  });
});

describe('isUsableProjectLocation', () => {
  it('accepts a plain existing directory', () => {
    expect(isUsableProjectLocation(sandbox())).toBe(true);
  });

  it('rejects the root, the home directory, files and missing paths', () => {
    expect(isUsableProjectLocation(path.parse(process.cwd()).root)).toBe(false);
    expect(isUsableProjectLocation(os.homedir())).toBe(false);
    const root = sandbox();
    const file = path.join(root, 'x.txt');
    fs.writeFileSync(file, 'x');
    expect(isUsableProjectLocation(file)).toBe(false);
    expect(isUsableProjectLocation(path.join(root, 'missing'))).toBe(false);
  });
});
