import type { HelpTarget } from '@/help/helpTopics';

export type HelpLayer = { id: string; type: string };

export type HelpNavigationDeps = {
  hasSettings: boolean;
  layerTypes: string[];
  hasProjectPath: boolean;
};

/** The layer type a help target points at; `quest-map` is the rules layer, `display` is settings. */
export function layerTypeForHelpTarget(target: HelpTarget): string {
  return target === 'quest-map' ? 'rules' : target;
}

export function canGoHelp(target: HelpTarget, deps: HelpNavigationDeps): boolean {
  if (target === 'display') return deps.hasSettings;
  if (target === 'quest-map') return deps.layerTypes.includes('rules') && deps.hasProjectPath;
  return deps.layerTypes.includes(target as string);
}

export function layerForHelpTarget(target: HelpTarget, layers: HelpLayer[] | undefined | null): HelpLayer | undefined {
  const type = layerTypeForHelpTarget(target);
  return (layers ?? []).find((layer) => layer.type === type);
}
