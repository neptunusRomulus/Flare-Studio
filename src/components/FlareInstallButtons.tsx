import React, { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import {
  getStoredFlarePath,
  setStoredFlarePath,
  variantForFlarePath,
  FLARE_PATH_EVENT,
  type FlareVariant,
} from '@/flare/flarePathStore';

export const FLARE_VARIANTS: { id: FlareVariant; label: string; description: string }[] = [
  {
    id: 'modern',
    label: 'Flare Modern',
    description:
      'The current Flare engine (1.15) with full HD era 192×96 art and all new engine features. Recommended.',
  },
  {
    id: 'classic',
    label: 'Flare Classic',
    description:
      "The older Flare engine (1.14) with 64×32 low-resolution art. Good for retro-style games, but you stay on the old engine and won't get new features.",
  },
];

export const FLARE_LINKS = [
  { label: 'Flare engine on GitHub', url: 'https://github.com/flareteam/flare-engine' },
  { label: 'Flare game on GitHub', url: 'https://github.com/flareteam/flare-game' },
  { label: 'flarerpg.org', url: 'https://flarerpg.org' },
];

export const FLARE_LICENSE_LINE =
  'Engine GPL-3.0+, art CC-BY-SA 3.0, fonts SIL OFL. © Flare team and contributors.';

function openLink(url: string) {
  const api = window.electronAPI;
  if (api?.openExternal) {
    void api.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

const FlareInstallButtons: React.FC = () => {
  const [installing, setInstalling] = useState<FlareVariant | null>(null);
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<{ variant: FlareVariant; version: string } | null>(null);
  const [active, setActive] = useState<FlareVariant | null>(() => variantForFlarePath(getStoredFlarePath()));

  useEffect(() => {
    const sync = () => setActive(variantForFlarePath(getStoredFlarePath()));
    window.addEventListener(FLARE_PATH_EVENT, sync);
    return () => window.removeEventListener(FLARE_PATH_EVENT, sync);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onInstallFlareProgress) return;
    return api.onInstallFlareProgress((payload) => {
      setProgress({ received: payload.received, total: payload.total });
    });
  }, []);

  const install = async (variant: FlareVariant) => {
    const api = window.electronAPI;
    setError(null);
    if (!api?.installFlare) {
      setError('Installing Flare needs the desktop app.');
      return;
    }
    setInstalling(variant);
    setProgress(null);
    try {
      const result = await api.installFlare(variant);
      if (result.ok) {
        setStoredFlarePath(result.exePath);
        setInstalled({ variant, version: result.version });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flare install failed.');
    } finally {
      setInstalling(null);
      setProgress(null);
    }
  };

  const percent = progress && progress.total > 0 ? Math.floor((progress.received / progress.total) * 100) : null;

  return (
    <>
      <div className="relative mt-6 flex justify-center gap-3" data-testid="flare-install">
        {FLARE_VARIANTS.map((v) => (
          <div key={v.id} className="relative">
            <Tooltip content={v.description} side="bottom">
              <Button
                variant="outline"
                className="relative w-40"
                disabled={installing !== null}
                onClick={() => install(v.id)}
              >
                {v.label}
                <span className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center" aria-hidden>
                  {installing === v.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" data-testid={`flare-install-spinner-${v.id}`} />
                  ) : active === v.id ? (
                    <Check className="h-4 w-4 text-orange-500" />
                  ) : null}
                </span>
              </Button>
            </Tooltip>
            {installing === v.id && percent !== null && (
              <span className="pointer-events-none absolute left-0 right-0 top-full mt-1 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {percent}%
              </span>
            )}
          </div>
        ))}
        {error && !installing && (
          <p role="alert" className="absolute left-0 right-0 top-full mt-1 whitespace-normal break-words text-center text-xs text-red-500">
            {error}
          </p>
        )}
      </div>

      {installed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-label="Flare installed">
          <div className="relative w-80 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setInstalled(null)}
              className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
            <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
              Flare {installed.version} installed
            </h4>
            <ul className="mb-3 space-y-1 text-sm">
              {FLARE_LINKS.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    onClick={(e) => {
                      e.preventDefault();
                      openLink(link.url);
                    }}
                    className="text-orange-600 hover:underline dark:text-orange-400"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-snug text-gray-500 dark:text-gray-400">{FLARE_LICENSE_LINE}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default FlareInstallButtons;
