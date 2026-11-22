import { describe, expect, it, vi } from 'vitest';
import { writeEventScript } from '@/components/events/eventScriptSave';

const file = { header: 'Story', steps: [{ components: [{ key: 'say', value: 'Hello' }] }] };

describe('writeEventScript', () => {
  it('refuses without a project or without a write channel', async () => {
    expect(await writeEventScript({ projectPath: null, scriptPath: 'intro', file, io: {} }))
      .toEqual({ ok: false, error: 'No project is open.' });
    expect(await writeEventScript({ projectPath: '/p', scriptPath: 'intro', file, io: {} }))
      .toEqual({ ok: false, error: 'No project is open.' });
  });

  it('writes under scripts/ and keeps the existing file as the merge base', async () => {
    const writeFile = vi.fn(async () => true);
    const readFile = vi.fn(async () => '# keep me\n');
    const result = await writeEventScript({ projectPath: '/p', scriptPath: 'intro', file, io: { readFile, writeFile } });
    expect(result.ok).toBe(true);
    expect(readFile).toHaveBeenCalledWith('/p/scripts/intro.txt');
    expect(writeFile).toHaveBeenCalledWith('/p/scripts/intro.txt', expect.stringContaining('# keep me'));
  });

  it('reports a failed write instead of pretending it saved', async () => {
    const result = await writeEventScript({
      projectPath: '/p', scriptPath: 'scripts/intro.txt', file,
      io: { readFile: async () => null, writeFile: async () => false },
    });
    expect(result).toEqual({ ok: false, error: 'Could not write the script file.' });
  });
});
