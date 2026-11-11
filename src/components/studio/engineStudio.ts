export type EngineStudioView = 'files' | 'tree' | 'items' | 'problems';
export type EngineStudioRequest = { view: EngineStudioView; file?: string };

type Listener = (req: EngineStudioRequest | null) => void;
const listeners = new Set<Listener>();
let current: EngineStudioRequest | null = null;

export function openEngineStudio(view: EngineStudioView, file?: string) {
  current = { view, file };
  for (const listener of listeners) listener(current);
}

export function closeEngineStudio() {
  current = null;
  for (const listener of listeners) listener(null);
}

export function subscribeEngineStudio(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
