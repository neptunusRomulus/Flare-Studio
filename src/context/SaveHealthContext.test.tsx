// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { SaveHealthProvider, useRegisterDirty, useSaveHealth } from './SaveHealthContext';

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useSaveHealth>) => void }) {
  const api = useSaveHealth();
  onReady(api);
  return null;
}

function Editor({ id, dirty, save }: { id: string; dirty: boolean; save?: () => Promise<void> }) {
  useRegisterDirty(id, dirty, save);
  return null;
}

describe('SaveHealthContext', () => {
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
});
