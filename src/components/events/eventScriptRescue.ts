import { eventScriptRelPath, mergeEventScript, type EventScriptComponent } from '@/editor/eventScripts';

type Args = {
  script: string;
  leftover: EventScriptComponent[];
  projectPath?: string | null;
  mapName?: string | null;
  coordinates: { x: number; y: number };
};

/** Where a rescued action block would be written, if it needs writing at all. */
export type ScriptRescue = { script: string; absPath: string; content: string };

/**
 * An event edited without an action file still carries its old `script=` keys in
 * the map object. Saving would drop them, so they are first written to a fresh
 * script named after the map and the event's position.
 */
export function planScriptRescue({ script, leftover, projectPath, mapName, coordinates }: Args): ScriptRescue | null {
  if (script) return null;
  if (!leftover.length) return null;
  if (!projectPath) return null;
  const stamp = `${(mapName || 'map').replace(/[^A-Za-z0-9]+/g, '_')}_${coordinates.x}_${coordinates.y}`;
  const rel = eventScriptRelPath(stamp);
  return {
    script: rel,
    absPath: `${projectPath.replace(/\\/g, '/')}/${rel}`,
    content: mergeEventScript('', { header: '', steps: [{ components: leftover }] }),
  };
}
