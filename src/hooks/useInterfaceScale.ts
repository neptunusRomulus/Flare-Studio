import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  INTERFACE_SCALE_DEFAULT,
  TEXT_SCALE_DEFAULT,
  applyTextScaleToDocument,
  interfaceZoomFactor,
  matchInterfaceScaleShortcut,
  parseScale,
  readStoredScales,
  stepScale,
  writeStoredScales,
  type DisplayScaleSettings,
  type InterfaceScaleShortcut,
} from '@/editor/interfaceScale';

type Listener = () => void;

let settings: DisplayScaleSettings = { interfaceScale: INTERFACE_SCALE_DEFAULT, textScale: TEXT_SCALE_DEFAULT };
let loaded = false;
let lastShortcutAt = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

function persist(next: DisplayScaleSettings) {
  settings = next;
  writeStoredScales(storage(), next);
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  void api?.setDisplaySettings?.(next);
  emit();
}

function applyInterface(percent: number) {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const factor = interfaceZoomFactor(percent);
  if (api?.setZoomFactor) void api.setZoomFactor(factor);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'));
  }
}

function applyText(percent: number) {
  applyTextScaleToDocument(percent);
}

export function getDisplayScaleSettings(): DisplayScaleSettings {
  return settings;
}

export function setInterfaceScale(percent: number) {
  const interfaceScale = parseScale(percent);
  persist({ ...settings, interfaceScale });
  applyInterface(interfaceScale);
}

export function setTextScale(percent: number) {
  const textScale = parseScale(percent, TEXT_SCALE_DEFAULT);
  persist({ ...settings, textScale });
  applyText(textScale);
}

export function stepInterfaceScale(direction: 1 | -1) {
  setInterfaceScale(stepScale(settings.interfaceScale, direction));
}

export function resetInterfaceScale() {
  setInterfaceScale(INTERFACE_SCALE_DEFAULT);
}

function applyShortcut(kind: InterfaceScaleShortcut) {
  const now = Date.now();
  // Menu accelerators and a window keydown can both fire; keep a single step.
  if (now - lastShortcutAt < 60) return;
  lastShortcutAt = now;
  if (kind === 'reset') resetInterfaceScale();
  else stepInterfaceScale(kind === 'in' ? 1 : -1);
}

async function hydrateFromAppSettings() {
  if (loaded) return;
  loaded = true;
  const local = readStoredScales(storage());
  settings = local;
  applyText(settings.textScale);
  applyInterface(settings.interfaceScale);
  emit();
  try {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    const saved = await api?.getDisplaySettings?.();
    if (!saved) return;
    const next = {
      interfaceScale: parseScale(saved.interfaceScale, settings.interfaceScale),
      textScale: parseScale(saved.textScale, settings.textScale),
    };
    settings = next;
    writeStoredScales(storage(), next);
    applyText(next.textScale);
    applyInterface(next.interfaceScale);
    emit();
  } catch {
    // localStorage values already applied
  }
}

void hydrateFromAppSettings();

export function useDisplayScale() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => settings,
    () => settings,
  );
  return {
    interfaceScale: snapshot.interfaceScale,
    textScale: snapshot.textScale,
    setInterfaceScale,
    setTextScale,
    stepInterfaceScale,
    resetInterfaceScale,
  };
}

export default function useInterfaceScale() {
  const scale = useDisplayScale();

  const onShortcut = useCallback((event: KeyboardEvent) => {
    const kind = matchInterfaceScaleShortcut(event);
    if (!kind) return;
    event.preventDefault();
    applyShortcut(kind);
  }, []);

  useEffect(() => {
    void hydrateFromAppSettings();
    window.addEventListener('keydown', onShortcut, true);
    const api = window.electronAPI;
    const stop = api?.onInterfaceScaleMenu?.((kind) => applyShortcut(kind));
    return () => {
      window.removeEventListener('keydown', onShortcut, true);
      stop?.();
    };
  }, [onShortcut]);

  return scale;
}
