import { TileSizeForm } from './studio/studioEditors';

/** Left sidebar content for the Game Settings layer; replaces the tileset palette. */
export default function SidebarGameSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <div className="text-sm font-semibold">Game Settings</div>
      <p className="text-[11px] text-muted-foreground">HUD and menu panels (menus/*.txt) are edited on the canvas. Drag a panel to write its pos=; other keys stay as they are.</p>
      <TileSizeForm />
    </div>
  );
}
