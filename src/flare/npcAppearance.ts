/**
 * Beginner-friendly NPC appearance: fantasycore looks + default sprite for new NPCs.
 * Selecting a look sets tilesetPath to an animations/npcs/*.txt path so Flare shows it
 * without Studio regenerating (and never overwriting) hand-made animation files.
 */
import { getStoredFlarePath } from '@/flare/flarePathStore';
import type { TemplateActorListing } from '@/flare/templateActors';
import { titleFromKey } from '@/flare/templateActors';

export type NpcLookOption = {
  key: string;
  label: string;
  animation: string;
  image: string | null;
  imagePath: string | null;
  source: 'fantasycore' | 'project';
};

export type NpcPortraitOption = {
  key: string;
  label: string;
  path: string;
  imagePath: string | null;
  source: 'fantasycore' | 'project';
};

/** Preferred default when fantasycore is available. */
export const DEFAULT_NPC_LOOK_KEY = 'peasant_man1';

export function pickDefaultNpcLook(looks: NpcLookOption[]): NpcLookOption | null {
  if (!looks.length) return null;
  return looks.find((l) => l.key === DEFAULT_NPC_LOOK_KEY) || looks[0];
}

export function looksFromTemplateListing(listing: Pick<TemplateActorListing, 'npcLooks'> | null | undefined): NpcLookOption[] {
  return (listing?.npcLooks || []).map((look) => ({
    key: look.key,
    label: titleFromKey(look.key),
    animation: look.animation,
    image: look.image,
    imagePath: look.imagePath,
    source: 'fantasycore' as const,
  }));
}

export function portraitsFromTemplateListing(listing: Pick<TemplateActorListing, 'portraits'> | null | undefined): NpcPortraitOption[] {
  return (listing?.portraits || []).map((p) => ({
    key: p.key,
    label: titleFromKey(p.key),
    path: p.path,
    imagePath: p.imagePath,
    source: 'fantasycore' as const,
  }));
}

/** Properties to apply when the user picks a fantasycore/project animation look (not a custom import). */
export function appearanceSelectionProps(look: NpcLookOption): Record<string, string | null> {
  return {
    tilesetPath: look.animation,
    templateImage: look.image,
    tilesetSourcePath: null,
    anim_render_width: null,
    anim_render_height: null,
    anim_render_offset_x: null,
    anim_render_offset_y: null,
    anim_frames: null,
    anim_duration: null,
    anim_type: null,
    anim_blend_mode: null,
    anim_alpha_mod: null,
    anim_color_mod: null,
    anim_image_width: null,
    anim_image_height: null,
  };
}

export function portraitSelectionProps(portrait: NpcPortraitOption): Record<string, string | null> {
  return {
    portraitPath: portrait.path,
    portraitSourcePath: null,
  };
}

/** Resolve a default fantasycore look for a brand-new NPC (name-only create). */
export async function resolveDefaultNpcAppearance(): Promise<Record<string, string>> {
  const flarePath = getStoredFlarePath();
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!flarePath || !api?.listTemplateActors) return {};
  try {
    const listing = await api.listTemplateActors(flarePath);
    if (!listing.ok) return {};
    const look = pickDefaultNpcLook(looksFromTemplateListing(listing));
    if (!look) return {};
    const props = appearanceSelectionProps(look);
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value != null) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
