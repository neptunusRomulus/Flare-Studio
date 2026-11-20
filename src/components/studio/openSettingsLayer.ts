/** Open a settings layer (for example Localization from the UI Settings card). */
export const OPEN_SETTINGS_LAYER_EVENT = 'flare-studio:open-settings-layer';

export function openSettingsLayer(type: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_LAYER_EVENT, { detail: { type } }));
}
