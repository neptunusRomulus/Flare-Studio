// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { SaveHealthProvider, useRegisterDirty, useSaveHealth } from './SaveHealthContext';

vi.mock('@/editor/projectFiles', () => ({
  writeProjectFiles: vi.fn(async () => true),
}));

import { writeProjectFiles } from '@/editor/projectFiles';

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useSaveHealth>) => void }) {
  const api = useSaveHealth();
  onReady(api);
  return null;
}

function Editor({ id, dirty, save, files }: { id: string; dirty: boolean; save?: () => Promise<void>; files?: { path: string; content: string }[] }) {
  useRegisterDirty(id, dirty, save, files);
  return null;
}

describe('SaveHealthContext', () => {
  beforeEach(() => {
    vi.mocked(writeProjectFiles).mockClear();
    vi.mocked(writeProjectFiles).mockResolvedValue(true);
  });

  it('aggregates dirty flags from registered editors and flushes only the dirty savers', async () => {
    const books = vi.fn(async () => {});
    const cutscenes = vi.fn(async () => {});
    let api: ReturnType<typeof useSaveHealth> | null = null;
    const { rerender } = render(
      <SaveHealthProvider>
        <Probe onReady={(value) => { api = value; }} />
        <Editor id="books" dirty save={books} />
        <Editor id="cutscenes" dirty={false} save={cutscenes} />
      </SaveHealthProvider>,
    );
    await waitFor(() => expect(api?.editorDirty).toBe(true));
    expect(api!.sources).toMatchObject({ books: true, cutscenes: false });

    await act(async () => { await api?.saveDirtySources(); });
    expect(books).toHaveBeenCalledTimes(1);
    expect(cutscenes).not.toHaveBeenCalled();

    rerender(
      <SaveHealthProvider>
        <Probe onReady={(value) => { api = value; }} />
        <Editor id="books" dirty={false} save={books} />
        <Editor id="cutscenes" dirty={false} save={cutscenes} />
      </SaveHealthProvider>,
    );
    await waitFor(() => expect(api?.editorDirty).toBe(false));
  });

  it('keeps an unmounted dirty panel and writes its file snapshot on saveAll', async () => {
    let api: ReturnType<typeof useSaveHealth> | null = null;
    const { rerender } = render(
      <SaveHealthProvider>
        <Probe onReady={(value) => { api = value; }} />
        <Editor id="books" dirty files={[{ path: 'books/lore.txt', content: 'hello' }]} />
      </SaveHealthProvider>,
    );
    await waitFor(() => expect(api?.editorDirty).toBe(true));

    rerender(
      <SaveHealthProvider>
        <Probe onReady={(value) => { api = value; }} />
      </SaveHealthProvider>,
    );
    await waitFor(() => expect(api?.editorDirty).toBe(true));
    expect(api!.collectEditorDrafts()).toEqual({ books: [{ path: 'books/lore.txt', content: 'hello' }] });

    await act(async () => { await api?.saveDirtySources('/proj'); });
    expect(writeProjectFiles).toHaveBeenCalledWith('/proj', [{ path: 'books/lore.txt', content: 'hello' }]);
    await waitFor(() => expect(api?.editorDirty).toBe(false));
  });
});
