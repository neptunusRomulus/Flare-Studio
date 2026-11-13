import { describe, it, expect } from 'vitest';
import { TARGET_ICON } from '@/components/targetIcons';
import { TARGET_GROUPS } from '@/components/targetGroups';

describe('TARGET_ICON', () => {
  it('has an icon for every dock sub-target', () => {
    for (const group of TARGET_GROUPS) {
      for (const t of group.targets) expect(TARGET_ICON[t], `${group.id}/${t}`).toBeTruthy();
    }
  });
});
