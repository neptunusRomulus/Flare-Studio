import { describe, expect, it } from 'vitest';
import {
  appearanceSelectionProps,
  DEFAULT_NPC_LOOK_KEY,
  looksFromTemplateListing,
  pickDefaultNpcLook,
  portraitsFromTemplateListing,
  type NpcLookOption,
} from './npcAppearance';
import { isAnimationDefinitionFilePath, isImageFilePath } from '@/utils/animationUtils';

describe('npc appearance defaults', () => {
  const looks: NpcLookOption[] = [
    { key: 'knight', label: 'Knight', animation: 'animations/npcs/knight.txt', image: 'images/npcs/knight.png', imagePath: null, source: 'fantasycore' },
    { key: DEFAULT_NPC_LOOK_KEY, label: 'Peasant Man 1', animation: 'animations/npcs/peasant_man1.txt', image: 'images/npcs/peasant_man1.png', imagePath: null, source: 'fantasycore' },
  ];

  it('prefers peasant_man1 when available', () => {
    expect(pickDefaultNpcLook(looks)?.key).toBe(DEFAULT_NPC_LOOK_KEY);
  });

  it('falls back to the first look', () => {
    expect(pickDefaultNpcLook([looks[0]])?.key).toBe('knight');
    expect(pickDefaultNpcLook([])).toBeNull();
  });

  it('maps listing looks and portraits', () => {
    expect(looksFromTemplateListing({
      npcLooks: [{ key: 'knight', animation: 'animations/npcs/knight.txt', image: 'images/npcs/knight.png', imagePath: '/x/knight.png' }],
    })).toEqual([expect.objectContaining({ key: 'knight', source: 'fantasycore', imagePath: '/x/knight.png' })]);
    expect(portraitsFromTemplateListing({
      portraits: [{ key: 'male01', path: 'images/portraits/male01.png', imagePath: '/x/male01.png' }],
    })).toEqual([expect.objectContaining({ key: 'male01', path: 'images/portraits/male01.png', source: 'fantasycore' })]);
  });

  it('selecting a look points at the animation definition (never a custom studio overwrite path)', () => {
    const props = appearanceSelectionProps(looks[1]);
    expect(props.tilesetPath).toBe('animations/npcs/peasant_man1.txt');
    expect(props.tilesetSourcePath).toBeNull();
    expect(isAnimationDefinitionFilePath(String(props.tilesetPath))).toBe(true);
    expect(isImageFilePath(String(props.tilesetPath))).toBe(false);
  });
});
