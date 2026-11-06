import { TileSizeForm } from './studio/studioEditors';

/** Left sidebar content for the Game Settings layer; replaces the tileset palette. */
export default function SidebarGameSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <div className="text-sm font-semibold">Game Settings</div>
      <TileSizeForm />
    </div>
  );
}
