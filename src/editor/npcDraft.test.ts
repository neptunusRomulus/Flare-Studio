import { describe, expect, it } from 'vitest';
import { checkNpcDraftName } from '@/editor/npcDraft';

describe('sidebar NPC draft name', () => {
  it('requires a name, ignoring whitespace', () => {
    expect(checkNpcDraftName('', [])).toEqual({ ok: false, message: 'Name is required.' });
    expect(checkNpcDraftName('   ', [])).toEqual({ ok: false, message: 'Name is required.' });
  });

  it('trims the accepted name', () => {
    expect(checkNpcDraftName('  Elder  ', [])).toEqual({ ok: true, name: 'Elder' });
  });

  it('asks before reusing a name (case-insensitive) and allows it when forced', () => {
    expect(checkNpcDraftName('elder', ['Elder'])).toEqual({
      ok: false,
      message: 'An NPC named "elder" already exists.',
      needsConfirm: true,
    });
    expect(checkNpcDraftName('elder', ['Elder'], true)).toEqual({ ok: true, name: 'elder' });
  });

  it('ignores blank existing names', () => {
    expect(checkNpcDraftName('Elder', ['', '   '])).toEqual({ ok: true, name: 'Elder' });
  });
});
