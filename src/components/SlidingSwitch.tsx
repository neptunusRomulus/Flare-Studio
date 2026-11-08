import React from 'react';
import Tooltip from '@/components/ui/tooltip';

export const SWITCH_BTN = 28; // px, square buttons
const GAP = 4;

export type SwitchItem = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: React.ReactNode;
  label: string;
  /** Dimmed look (e.g. hidden layer); selection is unaffected. */
  dimmed?: boolean;
  onWheel?: (e: React.WheelEvent<HTMLButtonElement>) => void;
  /** Small control rendered in the button's corner (e.g. visibility eye). */
  corner?: React.ReactNode;
};

type Props = { items: SwitchItem[]; selected: string | null; onSelect: (key: string) => void; ariaLabel?: string };

/** Square-button switch with a sliding orange highlighter (shared by the main and sub switches). */
const SlidingSwitch: React.FC<Props> = ({ items, selected, onSelect, ariaLabel }) => {
  const idx = selected ? items.findIndex(i => i.key === selected) : -1;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  return (
    <div role="group" aria-label={ariaLabel} className="relative flex rounded-md bg-muted p-0.5" style={{ gap: GAP }}>
      <div
        aria-hidden
        className="absolute top-0.5 left-0.5 rounded bg-primary"
        style={{
          width: SWITCH_BTN,
          height: SWITCH_BTN,
          opacity: idx >= 0 ? 1 : 0,
          transform: `translateX(${Math.max(0, idx) * (SWITCH_BTN + GAP)}px)`,
          transition: reduce ? 'none' : 'transform 180ms ease, opacity 180ms ease',
        }}
      />
      {items.map(item => {
        const Icon = item.icon;
        const sel = item.key === selected;
        return (
          <div key={item.key} className="relative z-10" style={{ width: SWITCH_BTN, height: SWITCH_BTN }}>
            <Tooltip content={item.tooltip} side="bottom">
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={sel}
                onClick={() => onSelect(item.key)}
                onWheel={item.onWheel}
                className={`inline-flex items-center justify-center rounded ${sel ? 'text-primary-foreground' : 'text-gray-400 dark:text-gray-500 hover:text-gray-500'}`}
                style={{ width: SWITCH_BTN, height: SWITCH_BTN, opacity: item.dimmed ? 0.4 : 1, transition: reduce ? 'none' : 'color 180ms ease, opacity 180ms ease' }}
              >
                <Icon className="w-4 h-4" />
              </button>
            </Tooltip>
            {item.corner && <div className="absolute -top-0.5 -right-0.5">{item.corner}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default SlidingSwitch;
