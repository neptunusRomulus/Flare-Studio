/** Per-activation-type colour tokens shared between sidebar badges and EventDialog buttons. */
export const ACTIVATION_COLORS: Record<string, { badge: string; active: string; icon: string }> = {
  Interact:  { badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',       active: 'border-blue-500/50 bg-blue-500/10 text-blue-600',     icon: 'text-blue-500' },
  Trigger:   { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',   active: 'border-amber-500/50 bg-amber-500/10 text-amber-600',   icon: 'text-amber-500' },
  Leave:     { badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',       active: 'border-rose-500/50 bg-rose-500/10 text-rose-600',     icon: 'text-rose-500' },
  Load:      { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600', icon: 'text-emerald-500' },
  MapExit:   { badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30', active: 'border-purple-500/50 bg-purple-500/10 text-purple-600', icon: 'text-purple-500' },
  MapClear:  { badge: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',       active: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600',     icon: 'text-cyan-500' },
  Loop:      { badge: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30', active: 'border-orange-500/50 bg-orange-500/10 text-orange-600', icon: 'text-orange-500' },
};
