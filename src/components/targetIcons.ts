import type React from 'react';
import { Image as MapImage, Box, Grid, Map as MapIcon, Users, Locate, Clock, Shapes, Sword, Tag, GitBranch, Library, Settings } from 'lucide-react';

type IconC = React.ComponentType<{ className?: string }>;
/** Icons per target layer type (same icons the old sidebar rows used). */
export const TARGET_ICON: Record<string, IconC> = {
  background: MapImage, object: Box, collision: Grid,
  npc: Users, enemy: Locate, event: Clock,
  items: Sword, status: Tag, rules: GitBranch,
};
/** Icons for the main layer switch at the top of the right dock. */
export const GROUP_ICON: Record<string, IconC> = { map: MapIcon, entities: Shapes, content: Library, gameSettings: Settings };
