import { useEffect } from 'react';

export default function useBrushToolDomSync(brushTool: string) {
  useEffect(() => {
    if (!brushTool) return;
    const selector = '[data-brush-tool]';
    const existing = document.querySelector(selector) as HTMLElement | null;
    if (existing) {
      existing.setAttribute('data-brush-tool', brushTool);
    } else {
      const el = document.createElement('div');
      el.setAttribute('data-brush-tool', brushTool);
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    return () => {
      // keep the element around — we only update its attribute
    };
  }, [brushTool]);
}
