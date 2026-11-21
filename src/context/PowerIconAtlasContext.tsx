import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notifyPowerFilePatches } from '@/components/powers/usePowerProjectFiles';
import { useAppContext } from '@/context/AppContext';
import { useRegisterDirty } from '@/context/SaveHealthContext';
import { loadEngineFileWithFallback, resolveExistingPath } from '@/editor/engineFileFallback';
import {
  ICONS_PNG,
  STUDIO_ICON_MAP_PATH,
  STUDIO_ICONS_DIR,
  applyIconAssignmentsToFiles,
  applyPackedAssignments,
  cropIconCell,
  markPending,
  mapsEqual,
  normalizeIconCell,
  ownerKey,
  packIconAtlas,
  parseIconSize,
  parseStudioIconMap,
  parseStudioStart,
  resolveIconWorkflow,
  resolveProjectIconAtlas,
  serializeStudioIconMap,
  shouldSkipProjectAtlasBuild,
  type IconWorkflow,
  type StudioIconMap,
} from '@/editor/iconAtlas';
import { loadProjectTextMap, writeProjectFiles } from '@/editor/projectFiles';
import { joinPath } from '@/editor/powers/powerFiles';
import { parseIconsFile, RESOLUTIONS_PATH } from '@/editor/uiEngine';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { projectStartFor } from '@/flare/projectTemplate';
import { askChoice } from '@/components/ui/inline-confirm';
import { toast } from '@/hooks/use-toast';

export type PowerIconKind = 'power' | 'effect';

type AtlasImage = {
  rel: string;
  firstId: number;
  dataUrl: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

type PowerIconAtlasValue = {
  iconSize: number;
  warning: string | null;
  workflow: IconWorkflow;
  canImport: boolean;
  previewFor: (kind: PowerIconKind, id: string, iconValue?: string | null) => string | null;
  importFor: (kind: PowerIconKind, id: string, currentIcon?: string | null) => Promise<void>;
};

const EMPTY: PowerIconAtlasValue = {
  iconSize: 32,
  warning: null,
  workflow: 'author',
  canImport: true,
  previewFor: () => null,
  importFor: async () => {},
};

const PowerIconAtlasContext = createContext<PowerIconAtlasValue>(EMPTY);

function api() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

async function pixelsFromDataURL(dataUrl: string): Promise<{ width: number; height: number; pixels: Uint8ClampedArray } | null> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: data.width, height: data.height, pixels: new Uint8ClampedArray(data.data) };
}

function dataURLFromPixels(width: number, height: number, pixels: Uint8ClampedArray): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const data = ctx.createImageData(width, height);
  data.data.set(pixels);
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

function iconNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 ? num : null;
}

async function detectProjectAtlas(projectPath: string, iconsTxt: string | null | undefined) {
  const electron = api();
  const rels = new Set<string>([ICONS_PNG]);
  for (const set of parseIconsFile(iconsTxt || '').sets) {
    const rel = set.file.replace(/\\/g, '/').replace(/^\/+/, '');
    if (rel) rels.add(rel);
  }
  const hasFile: Record<string, boolean> = {};
  await Promise.all([...rels].map(async (rel) => {
    hasFile[rel] = !!(electron?.fileExists && await electron.fileExists(joinPath(projectPath, rel)));
  }));
  return resolveProjectIconAtlas({ projectHasFile: (rel) => !!hasFile[rel], iconsTxt });
}

function overrideWarning(opts: {
  workflow: IconWorkflow;
  projectHasAtlas: boolean;
  map: StudioIconMap;
  requiredModProvidesIcons: boolean;
}) {
  const skip = shouldSkipProjectAtlasBuild({
    workflow: opts.workflow,
    projectHasAtlas: opts.projectHasAtlas,
    importedSourceCount: Object.keys(opts.map.sources).length,
    requiredModProvidesIcons: opts.requiredModProvidesIcons,
    overrideConfirmed: opts.map.modOverrideConfirmed,
  });
  if (!skip.skip) return null;
  return Object.keys(opts.map.sources).length > 0 ? skip.reason : null;
}

async function confirmChoice(title: string, detail: string, confirmId: string, confirmLabel: string): Promise<boolean> {
  const answer = await askChoice({
    title,
    detail,
    options: [
      { id: 'cancel', label: 'Cancel' },
      { id: confirmId, label: confirmLabel, primary: true },
    ],
    cancelId: 'cancel',
  });
  return answer === confirmId;
}

export function PowerIconAtlasProvider({ children }: { children: ReactNode }) {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [map, setMap] = useState<StudioIconMap>(parseStudioIconMap(null));
  const [iconSize, setIconSize] = useState(32);
  const [warning, setWarning] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<IconWorkflow>('author');
  const [requiredModProvidesIcons, setRequiredModProvidesIcons] = useState(false);
  const [projectHasAtlas, setProjectHasAtlas] = useState(false);
  const [sourcePreviews, setSourcePreviews] = useState<Record<string, string>>({});
  const [atlas, setAtlas] = useState<AtlasImage | null>(null);
  const [diskMap, setDiskMap] = useState<StudioIconMap>(parseStudioIconMap(null));
  const mapRef = useRef(map);
  const workflowRef = useRef<IconWorkflow>('author');
  const requiredModRef = useRef(false);
  const hasAtlasRef = useRef(false);
  const iconSizeRef = useRef(iconSize);
  const atlasRef = useRef(atlas);
  const diskMapRef = useRef(diskMap);
  mapRef.current = map;
  workflowRef.current = workflow;
  requiredModRef.current = requiredModProvidesIcons;
  hasAtlasRef.current = projectHasAtlas;
  iconSizeRef.current = iconSize;
  atlasRef.current = atlas;
  diskMapRef.current = diskMap;

  const skip = shouldSkipProjectAtlasBuild({
    workflow,
    projectHasAtlas,
    importedSourceCount: Object.keys(map.sources).length,
    requiredModProvidesIcons,
    overrideConfirmed: map.modOverrideConfirmed,
  });
  const dirty = !mapsEqual(map, diskMap) || (map.pending.length > 0 && !skip.skip);

  const persistMap = useCallback(async (next: StudioIconMap) => {
    if (!projectPath) return false;
    const ok = await api()?.writeFile?.(joinPath(projectPath, STUDIO_ICON_MAP_PATH), serializeStudioIconMap(next));
    if (ok) setDiskMap(next);
    return !!ok;
  }, [projectPath]);

  const refresh = useCallback(async () => {
    if (!projectPath || !api()?.readFile) {
      setMap(parseStudioIconMap(null));
      setDiskMap(parseStudioIconMap(null));
      setWarning(null);
      setWorkflow('author');
      setRequiredModProvidesIcons(false);
      setProjectHasAtlas(false);
      setSourcePreviews({});
      setAtlas(null);
      return;
    }
    const electron = api()!;
    const flarePath = getStoredFlarePath();
    const fs = { readFile: electron.readFile!, fileExists: electron.fileExists! };
    const [mapText, resolutions, projectIconsTxt, projectJson] = await Promise.all([
      electron.readFile(joinPath(projectPath, STUDIO_ICON_MAP_PATH)),
      loadEngineFileWithFallback({ projectPath, relative: RESOLUTIONS_PATH, flarePath, fs }),
      electron.readFile(joinPath(projectPath, 'engine/icons.txt')),
      electron.readFile(joinPath(projectPath, 'project.json')),
    ]);
    const nextMap = parseStudioIconMap(mapText);
    const size = parseIconSize(resolutions.text);
    const packTarget = await detectProjectAtlas(projectPath, projectIconsTxt);

    const displayRel = packTarget.exists ? packTarget.rel : ICONS_PNG;
    const resolvedIcons = await loadEngineFileWithFallback({
      projectPath,
      relative: 'engine/icons.txt',
      flarePath,
      fs,
    });
    const listed = parseIconsFile(resolvedIcons.text).sets.find((set) => set.file.replace(/\\/g, '/') === displayRel);
    const firstId = packTarget.exists
      ? packTarget.firstId
      : (Number.isInteger(Number(listed?.firstId)) && Number(listed?.firstId) >= 0 ? Number(listed?.firstId) : 0);
    const abs = packTarget.exists
      ? joinPath(projectPath, packTarget.rel)
      : await resolveExistingPath({
          projectPath,
          relative: displayRel,
          flarePath,
          fileExists: fs.fileExists,
          readFile: fs.readFile,
        });
    let nextAtlas: AtlasImage | null = null;
    if (abs && electron.readFileAsDataURL) {
      const dataUrl = await electron.readFileAsDataURL(abs);
      const decoded = dataUrl ? await pixelsFromDataURL(dataUrl) : null;
      if (dataUrl && decoded) {
        nextAtlas = {
          rel: displayRel,
          firstId,
          dataUrl,
          width: decoded.width,
          height: decoded.height,
          pixels: decoded.pixels,
        };
      }
    }

    const previews: Record<string, string> = {};
    for (const rel of [...new Set(Object.values(nextMap.sources))]) {
      const dataUrl = electron.readFileAsDataURL ? await electron.readFileAsDataURL(joinPath(projectPath, rel)) : null;
      const decoded = dataUrl ? await pixelsFromDataURL(dataUrl) : null;
      if (!decoded) continue;
      const normalized = normalizeIconCell(decoded.pixels, decoded.width, decoded.height, size);
      previews[rel] = dataURLFromPixels(size, size, normalized);
    }

    const requiredMod = !packTarget.exists && !!abs;
    const studioStart = parseStudioStart(projectJson) ?? projectStartFor(projectPath);
    const resolved = resolveIconWorkflow({
      studioStart,
      projectHasAtlas: packTarget.exists,
      requiredModProvidesIcons: requiredMod,
    });
    setMap(nextMap);
    setDiskMap(nextMap);
    setIconSize(size);
    setWorkflow(resolved.workflow);
    setRequiredModProvidesIcons(requiredMod);
    setProjectHasAtlas(packTarget.exists);
    setWarning(overrideWarning({
      workflow: resolved.workflow,
      projectHasAtlas: packTarget.exists,
      map: nextMap,
      requiredModProvidesIcons: requiredMod,
    }));
    setSourcePreviews(previews);
    setAtlas(nextAtlas);
  }, [projectPath]);

  useEffect(() => { void refresh(); }, [refresh]);

  const previewFor = useCallback((kind: PowerIconKind, id: string, iconValue?: string | null) => {
    const key = ownerKey(kind, id);
    const current = mapRef.current;
    const source = current.sources[key];
    if (source && sourcePreviews[source]) return sourcePreviews[source];
    const index = current.indexes[key] ?? iconNumber(iconValue);
    const currentAtlas = atlasRef.current;
    if (index == null || !currentAtlas) return null;
    const size = iconSizeRef.current;
    const cropped = cropIconCell(currentAtlas.pixels, currentAtlas.width, currentAtlas.height, size, index, currentAtlas.firstId);
    if (!cropped) return null;
    return dataURLFromPixels(size, size, cropped);
  }, [sourcePreviews]);

  const importFor = useCallback(async (kind: PowerIconKind, id: string, currentIcon?: string | null) => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before importing icons.', variant: 'destructive' });
      return;
    }
    if (workflowRef.current === 'inherit') {
      await confirmChoice(
        "Can't replace a mod icon",
        "This project uses icons from a required mod. Creating a project icons.png would replace that atlas and change those icons everywhere they are used. Import is available in Start from scratch projects.",
        'ok',
        'OK',
      );
      return;
    }
    const key = ownerKey(kind, id);
    const current = mapRef.current;
    const existingIndex = current.indexes[key] ?? (currentIcon != null && currentIcon !== '' && Number.isInteger(Number(currentIcon)) ? Number(currentIcon) : null);
    if (current.sources[key] || existingIndex != null) {
      const ok = await confirmChoice(
        'Replace this icon?',
        existingIndex != null
          ? `This already uses icon ${existingIndex}. Replacing it changes that icon everywhere it is used.`
          : 'This already has an icon. Replacing it changes that icon everywhere it is used.',
        'replace',
        'Replace',
      );
      if (!ok) return;
    }
    if (!hasAtlasRef.current && requiredModRef.current && !current.modOverrideConfirmed) {
      const ok = await confirmChoice(
        'Create a project icon atlas?',
        "A new images/icons/icons.png will replace the required mod's atlas in the game. Existing mod icons will not be copied.",
        'create',
        'Create',
      );
      if (!ok) return;
      current.modOverrideConfirmed = true;
    }
    const electron = api();
    if (!electron?.importIconFiles) {
      toast({ title: 'Restart required', description: 'Icon import needs a full Electron restart (npm run electron-dev).', variant: 'destructive' });
      return;
    }
    const result = await electron.importIconFiles({
      projectPath,
      destDir: STUDIO_ICONS_DIR,
      title: 'Import power icon',
    });
    if (!result.success) {
      if (result.cancelled) return;
      toast({ title: 'Import failed', description: result.error || 'Could not import the icon.', variant: 'destructive' });
      return;
    }
    const files = result.files || [];
    const first = files[0];
    if (!first) return;
    const next = markPending(mapRef.current, key, first.rel);
    setMap(next);
    const dataUrl = electron.readFileAsDataURL ? await electron.readFileAsDataURL(joinPath(projectPath, first.rel)) : null;
    const decoded = dataUrl ? await pixelsFromDataURL(dataUrl) : null;
    if (decoded) {
      const size = iconSizeRef.current;
      const normalized = normalizeIconCell(decoded.pixels, decoded.width, decoded.height, size);
      setSourcePreviews((prev) => ({ ...prev, [first.rel]: dataURLFromPixels(size, size, normalized) }));
    }
    await persistMap(next);
    const message = overrideWarning({
      workflow: workflowRef.current,
      projectHasAtlas: hasAtlasRef.current,
      map: next,
      requiredModProvidesIcons: requiredModRef.current,
    });
    setWarning(message);
    const extras = files.slice(1);
    toast({
      title: 'Icon imported',
      description: extras.length
        ? `${first.name} attached. ${extras.length} more file(s) were copied to ${STUDIO_ICONS_DIR}/. Import from another power to attach them.`
        : `${first.name} will be packed into the icon atlas on save.`,
    });
    if (message) toast({ title: 'Atlas not built', description: message, variant: 'destructive' });
  }, [persistMap, projectPath]);

  const save = useCallback(async () => {
    if (!projectPath) return;
    const current = mapRef.current;
    const message = overrideWarning({
      workflow: workflowRef.current,
      projectHasAtlas: hasAtlasRef.current,
      map: current,
      requiredModProvidesIcons: requiredModRef.current,
    });
    if (message) {
      setWarning(message);
      await persistMap(current);
      return;
    }
    setWarning(null);
    if (current.pending.length === 0) {
      if (!mapsEqual(current, diskMapRef.current)) await persistMap(current);
      return;
    }
    const electron = api();
    if (!electron?.writeFileFromDataURL || !electron.readFileAsDataURL) {
      toast({ title: 'Restart required', description: 'Packing icons needs a full Electron restart (npm run electron-dev).', variant: 'destructive' });
      return;
    }
    const iconsTxt = await electron.readFile?.(joinPath(projectPath, 'engine/icons.txt'));
    const packTarget = await detectProjectAtlas(projectPath, iconsTxt);
    let existing: { width: number; height: number; pixels: Uint8ClampedArray } | null = null;
    if (packTarget.exists) {
      const dataUrl = await electron.readFileAsDataURL(joinPath(projectPath, packTarget.rel));
      const decoded = dataUrl ? await pixelsFromDataURL(dataUrl) : null;
      if (decoded) existing = decoded;
    }
    const size = iconSizeRef.current;
    const keys = current.pending.filter((key) => current.sources[key]);
    const cells: Array<{ pixels: Uint8ClampedArray; index?: number }> = [];
    const packedKeys: string[] = [];
    for (const key of keys) {
      const rel = current.sources[key];
      const dataUrl = await electron.readFileAsDataURL(joinPath(projectPath, rel));
      const decoded = dataUrl ? await pixelsFromDataURL(dataUrl) : null;
      if (!decoded) continue;
      packedKeys.push(key);
      cells.push({
        pixels: normalizeIconCell(decoded.pixels, decoded.width, decoded.height, size),
        index: current.indexes[key],
      });
    }
    if (!cells.length) {
      await persistMap(current);
      return;
    }
    const packed = packIconAtlas({
      iconSize: size,
      firstId: packTarget.firstId,
      existing,
      cells,
    });
    const dataUrl = dataURLFromPixels(packed.width, packed.height, packed.pixels);
    const written = await electron.writeFileFromDataURL(joinPath(projectPath, packTarget.rel), dataUrl);
    if (!written) {
      toast({ title: 'Icon atlas failed', description: `Could not write ${packTarget.rel}.`, variant: 'destructive' });
      return;
    }
    const assignments: Record<string, number> = {};
    packedKeys.forEach((key, index) => { assignments[key] = packed.assignments[index]; });
    const files = await loadProjectTextMap(projectPath);
    const nextFiles = applyIconAssignmentsToFiles(files, assignments);
    const changed = Object.entries(nextFiles).filter(([path, content]) => files[path] !== content);
    if (changed.length) {
      await writeProjectFiles(projectPath, changed.map(([path, content]) => ({ path, content })));
      notifyPowerFilePatches(Object.fromEntries(changed));
    }
    const nextMap = applyPackedAssignments(current, assignments);
    await persistMap(nextMap);
    setMap(nextMap);
    hasAtlasRef.current = true;
    setProjectHasAtlas(true);
    setRequiredModProvidesIcons(false);
    setAtlas({
      rel: packTarget.rel,
      firstId: packed.firstId,
      dataUrl,
      width: packed.width,
      height: packed.height,
      pixels: packed.pixels,
    });
  }, [persistMap, projectPath]);

  const draftFiles = useMemo(
    () => (dirty ? [{ path: STUDIO_ICON_MAP_PATH, content: serializeStudioIconMap(map) }] : []),
    [dirty, map],
  );
  useRegisterDirty('power-icon-atlas', dirty, save, draftFiles, (incoming) => {
    const file = incoming.find((entry) => entry.path === STUDIO_ICON_MAP_PATH) || incoming[0];
    if (!file) return;
    setMap(parseStudioIconMap(file.content));
  });

  const value = useMemo<PowerIconAtlasValue>(() => ({
    iconSize,
    warning,
    workflow,
    canImport: workflow === 'author',
    previewFor,
    importFor,
  }), [iconSize, warning, workflow, previewFor, importFor]);

  return <PowerIconAtlasContext.Provider value={value}>{children}</PowerIconAtlasContext.Provider>;
}

export function usePowerIconAtlas(): PowerIconAtlasValue {
  return useContext(PowerIconAtlasContext);
}
