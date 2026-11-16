/**
 * Enemy looks for the Edit Enemy window: fantasycore enemy sprites (animations/enemies/*.txt)
 * and the portraits shipped in the same mod. Selecting a look sets Flare's `animations`
 * key plus Studio's `tilesetPath` thumbnail source; portraits are Studio-only.
 */
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { titleFromKey, type TemplateActorListing } from '@/flare/templateActors';
import { portraitsFromTemplateListing, type NpcPortraitOption } from '@/flare/npcAppearance';

export type EnemyLookOption = {
  key: string;
  label: string;
  animation: string;
  image: string | null;
  imagePath: string | null;
  frame: { x: number; y: number; w: number; h: number } | null;
  source: 'fantasycore' | 'project';
};

type TemplateEnemyLook = NonNullable<TemplateActorListing['enemyLooks']>[number];

export function enemyLooksFromListing(
  listing: Pick<TemplateActorListing, 'enemyLooks'> | null | undefined,
): EnemyLookOption[] {
  return (listing?.enemyLooks || []).map((look: TemplateEnemyLook) => ({
    key: look.key,
    label: titleFromKey(look.key),
    animation: look.animation,
    image: look.image,
    imagePath: look.imagePath,
    frame: look.frame || null,
    source: 'fantasycore' as const,
  }));
}

/** Properties applied when the user picks an enemy look (mirrors NPC appearance selection). */
export function enemyLookSelectionProps(look: EnemyLookOption): Record<string, string | null> {
  return {
    animations: look.animation,
    tilesetPath: look.animation,
    gfx: null,
  };
}

/** The look that matches an enemy's stored paths, if any. */
export function findEnemyLook(
  looks: EnemyLookOption[],
  animations: string,
  tilesetPath: string,
): EnemyLookOption | null {
  const wanted = [animations, tilesetPath].map((v) => String(v || '').trim()).filter(Boolean);
  if (!wanted.length) return null;
  return looks.find((look) => wanted.includes(look.animation)) || null;
}

export type EnemyAppearanceApi = {
  listTemplateActors?: (flarePath: string) => Promise<TemplateActorListing>;
  readDir?: (path: string) => Promise<Array<{ name: string; isDirectory?: boolean }>>;
  readFile?: (path: string) => Promise<string | null>;
  fileExists?: (path: string) => Promise<boolean>;
};

/**
 * Fantasycore enemy looks (when Flare is installed) plus the project's own
 * animations/enemies/*.txt.
 */
export async function resolveEnemyLooks(
  projectPath: string | null | undefined,
  api: EnemyAppearanceApi | undefined = typeof window !== 'undefined' ? window.electronAPI : undefined,
  flarePath: string | null = getStoredFlarePath(),
): Promise<EnemyLookOption[]> {
  const looks: EnemyLookOption[] = [];
  let modDir: string | null = null;

  if (flarePath && api?.listTemplateActors) {
    try {
      const listing = await api.listTemplateActors(flarePath);
      if (listing.ok) {
        modDir = listing.modDir || null;
        looks.push(...enemyLooksFromListing(listing));
      }
    } catch {
      /* ignore: the project list below still works */
    }
  }

  const root = String(projectPath || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (root && api?.readDir) {
    try {
      const entries = await api.readDir(`${root}/animations/enemies`);
      for (const entry of entries.filter((e) => e.isDirectory === false && /\.txt$/i.test(e.name))) {
        const animation = `animations/enemies/${entry.name}`;
        if (looks.some((look) => look.animation === animation)) continue;
        let image: string | null = null;
        let imagePath: string | null = null;
        const text = api.readFile ? await api.readFile(`${root}/${animation}`) : null;
        if (text) {
          const match = text.match(/^\s*image=(.+)$/m);
          image = match ? match[1].trim() : null;
          if (image) {
            const projectImage = `${root}/${image}`;
            if (api.fileExists && await api.fileExists(projectImage)) imagePath = projectImage;
            else if (modDir) imagePath = `${modDir.replace(/\\/g, '/')}/${image}`;
          }
        }
        const key = entry.name.replace(/\.txt$/i, '');
        looks.push({ key, label: titleFromKey(key), animation, image, imagePath, frame: null, source: 'project' });
      }
    } catch {
      /* no project enemy animations */
    }
  }

  return looks;
}

/** Portraits for the enemy picker: fantasycore first, then the project's images/portraits. */
export async function resolveEnemyPortraits(
  projectPath: string | null | undefined,
  api: EnemyAppearanceApi | undefined = typeof window !== 'undefined' ? window.electronAPI : undefined,
  flarePath: string | null = getStoredFlarePath(),
): Promise<NpcPortraitOption[]> {
  const portraits: NpcPortraitOption[] = [];
  if (flarePath && api?.listTemplateActors) {
    try {
      const listing = await api.listTemplateActors(flarePath);
      if (listing.ok) portraits.push(...portraitsFromTemplateListing(listing));
    } catch {
      /* ignore */
    }
  }

  const root = String(projectPath || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (root && api?.readDir) {
    try {
      const entries = await api.readDir(`${root}/images/portraits`);
      for (const entry of entries.filter((e) => e.isDirectory === false && /\.png$/i.test(e.name))) {
        const path = `images/portraits/${entry.name}`;
        if (portraits.some((p) => p.path === path)) continue;
        const key = entry.name.replace(/\.png$/i, '');
        portraits.push({ key, label: key, path, imagePath: `${root}/${path}`, source: 'project' });
      }
    } catch {
      /* no project portraits */
    }
  }

  return portraits;
}
