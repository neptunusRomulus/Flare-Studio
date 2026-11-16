/**
 * Resolve an NPC's look and portrait to loadable local paths (absolute or data URL)
 * so list thumbnails and the Edit NPC preview can share the same image sources.
 */
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { isAnimationDefinitionFilePath, isImageFilePath } from '@/utils/animationUtils';

export type NpcPreviewInput = {
  tilesetPath?: string;
  templateImage?: string;
  tilesetSourcePath?: string;
  portraitPath?: string;
  /** Flare's `animations` key for enemies (their sprite lives in animations/enemies/*.txt). */
  animations?: string;
  projectPath?: string | null;
};

export type NpcPreviewPaths = { sprite: string | null; portrait: string | null };

type Listing = {
  npcLooks?: Array<{ animation?: string; image?: string | null; imagePath?: string | null }>;
  enemyLooks?: Array<{ animation?: string; image?: string | null; imagePath?: string | null }>;
  portraits?: Array<{ path: string; imagePath?: string | null }>;
  modDir?: string;
};

type PreviewApi = {
  listTemplateActors?: (flarePath: string) => Promise<Listing>;
  fileExists?: (path: string) => Promise<boolean>;
  readFile?: (path: string) => Promise<string | null>;
};

const listingCache = new Map<string, Promise<Listing | null>>();

function listingFor(api: PreviewApi | undefined, flarePath: string): Promise<Listing | null> {
  const key = flarePath.replace(/\\/g, '/');
  const existing = listingCache.get(key);
  if (existing) return existing;
  const pending = (api?.listTemplateActors
    ? api.listTemplateActors(flarePath).catch(() => null)
    : Promise.resolve(null));
  listingCache.set(key, pending);
  return pending;
}

function absOrJoin(root: string, path: string): string {
  return /^([a-zA-Z]:|\/)/.test(path) ? path : (root ? `${root}/${path}` : path);
}

export async function resolveNpcPreviewPaths(
  input: NpcPreviewInput,
  api: PreviewApi | undefined = typeof window !== 'undefined' ? window.electronAPI : undefined,
  flarePath: string | null = getStoredFlarePath(),
): Promise<NpcPreviewPaths> {
  const root = (input.projectPath || '').replace(/\\/g, '/').replace(/\/$/, '');
  const tilesetPath = input.tilesetPath || '';
  const animations = input.animations || '';
  const templateImage = input.templateImage || '';
  const tilesetSourcePath = input.tilesetSourcePath || '';
  const portraitPath = input.portraitPath || '';
  const lookPath = tilesetPath || animations;

  let sprite: string | null = null;
  if (tilesetSourcePath) sprite = tilesetSourcePath;
  else if (tilesetPath && isImageFilePath(tilesetPath)) {
    sprite = absOrJoin(root, tilesetPath);
  } else if (templateImage || (lookPath && isAnimationDefinitionFilePath(lookPath))) {
    if (flarePath) {
      const listing = await listingFor(api, flarePath);
      if (listing) {
        const looks = [...(listing.npcLooks || []), ...(listing.enemyLooks || [])];
        const match = looks.find((l) => l.animation === lookPath || l.image === templateImage);
        sprite = match?.imagePath
          || (listing.modDir && templateImage ? `${listing.modDir.replace(/\\/g, '/')}/${templateImage}` : null);
      }
    }
    // Project animations (not in the fantasycore listing): resolve their image= line.
    if (!sprite && root && lookPath && api?.readFile) {
      const text = await api.readFile(`${root}/${lookPath}`).catch(() => null);
      const image = text ? /^\s*image=(.+)$/m.exec(text)?.[1]?.trim() : null;
      if (image) {
        const candidate = absOrJoin(root, image);
        if (!api.fileExists || await api.fileExists(candidate)) sprite = candidate;
      }
    }
  }

  let portrait: string | null = null;
  if (portraitPath.startsWith('data:')) portrait = portraitPath;
  else if (portraitPath && /^([a-zA-Z]:|\/)/.test(portraitPath)) portrait = portraitPath;
  else if (portraitPath) {
    if (root && api?.fileExists && await api.fileExists(`${root}/${portraitPath}`)) {
      portrait = `${root}/${portraitPath}`;
    } else if (flarePath) {
      const listing = await listingFor(api, flarePath);
      if (listing) {
        portrait = listing.portraits?.find((p) => p.path === portraitPath)?.imagePath
          || (listing.modDir ? `${listing.modDir.replace(/\\/g, '/')}/${portraitPath}` : null);
      }
    }
  }

  return { sprite, portrait };
}

/** Portrait if we have one, otherwise the look sprite — same thumbnail sources as Edit NPC. */
export function npcListThumbPath(preview: NpcPreviewPaths): string | null {
  return preview.portrait || preview.sprite;
}
