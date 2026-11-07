import { describe, it, expect, vi } from 'vitest';
import { decideClose } from './closePrompt';

describe('decideClose', () => {
  it('closes without asking when nothing is unsaved', async () => {
    const ask = vi.fn();
    await expect(decideClose(false, ask)).resolves.toBe('close');
    expect(ask).not.toHaveBeenCalled();
  });
  it('passes through save / discard and maps anything else to cancel', async () => {
    await expect(decideClose(true, async () => 'save')).resolves.toBe('save');
    await expect(decideClose(true, async () => 'discard')).resolves.toBe('discard');
    await expect(decideClose(true, async () => 'cancel')).resolves.toBe('cancel');
    await expect(decideClose(true, async () => '')).resolves.toBe('cancel');
  });
});
