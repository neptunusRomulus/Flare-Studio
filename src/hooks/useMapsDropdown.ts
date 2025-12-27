import { useEffect, useRef, useState } from 'react';

export default function useMapsDropdown() {
  const [mapsDropdownOpen, setMapsDropdownOpen] = useState<boolean>(false);
  const mapsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mapsDropdownPos, setMapsDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const mapsPortalRef = useRef<HTMLDivElement | null>(null);
  const mapsSubPortalRef = useRef<HTMLDivElement | null>(null);
  const [mapsSubOpen, setMapsSubOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!mapsDropdownOpen) return;
    const computePos = () => {
      const btn = mapsButtonRef.current as HTMLButtonElement | null;
      if (!btn) return setMapsDropdownPos(null);
      const rect = btn.getBoundingClientRect();
      setMapsDropdownPos({ left: rect.left, top: rect.top - 8 });
    };
    computePos();
    window.addEventListener('resize', computePos);
    window.addEventListener('scroll', computePos, true);
    return () => {
      window.removeEventListener('resize', computePos);
      window.removeEventListener('scroll', computePos, true);
    };
  }, [mapsDropdownOpen]);

  useEffect(() => {
    if (!mapsDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMapsDropdownOpen(false);
        setMapsSubOpen(false);
      }
    };
    const onMouse = (e: MouseEvent) => {
      const portal = mapsPortalRef.current;
      const subportal = mapsSubPortalRef.current;
      const btn = mapsButtonRef.current;
      const target = e.target as Node | null;
      if (!portal) return;
      if (portal.contains(target)) return;
      if (subportal && subportal.contains(target)) return;
      if (btn && btn.contains(target)) return;
      setMapsDropdownOpen(false);
      setMapsSubOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouse);
    };
  }, [mapsDropdownOpen]);

  return {
    mapsDropdownOpen,
    setMapsDropdownOpen,
    mapsButtonRef,
    mapsDropdownPos,
    mapsPortalRef,
    mapsSubPortalRef,
    mapsSubOpen,
    setMapsSubOpen
  } as const;
}
