export type AnimationProps = Record<string, string>;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tga'];

export function isAnimationDefinitionFilePath(path: string): boolean {
  return path.trim().toLowerCase().endsWith('.txt');
}

export function isImageFilePath(path: string): boolean {
  const lower = path.trim().toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function getAnimationProps(properties: Record<string, string | undefined>): AnimationProps {
  const animKeys = [
    'anim_render_width',
    'anim_render_height',
    'anim_render_offset_x',
    'anim_render_offset_y',
    'anim_frames',
    'anim_duration',
    'anim_type',
    'anim_blend_mode',
    'anim_alpha_mod',
    'anim_color_mod'
  ];
  const animProps: AnimationProps = {};
  for (const key of animKeys) {
    const value = properties[key];
    if (value) {
      animProps[key] = value;
    }
  }
  return animProps;
}

export function buildSafeNpcAnimationFilename(npcName: string): string {
  return npcName
    .toLowerCase()
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_') || 'unnamed_npc';
}

export function buildAnimationFileContent(
  imageRelativePath: string,
  animProps: AnimationProps,
  defaultFrameCount = 1
): string {
  const lines: string[] = [`image=${imageRelativePath}`];
  lines.push('');

  const rw = animProps.anim_render_width;
  const rh = animProps.anim_render_height;
  const frameCount = parseInt(animProps.anim_frames || String(defaultFrameCount), 10) || defaultFrameCount;
  const duration = animProps.anim_duration || (frameCount > 1 ? '1200ms' : '1s');
  const animType = animProps.anim_type || 'looped';
  const blendMode = animProps.anim_blend_mode || 'normal';
  const alphaMod = animProps.anim_alpha_mod || '255';
  const colorMod = animProps.anim_color_mod || '255,255,255';

  if (rw && rh) {
    const frameW = parseInt(rw, 10);
    const frameH = parseInt(rh, 10);
    const offsetX = parseInt(animProps.anim_render_offset_x || String(Math.floor(frameW / 2)), 10);
    const offsetY = parseInt(animProps.anim_render_offset_y || String(frameH - 2), 10);

    lines.push(`render_size=${frameW},${frameH}`);
    lines.push(`render_offset=${offsetX},${offsetY}`);
    if (blendMode !== 'normal') lines.push(`blend_mode=${blendMode}`);
    if (alphaMod !== '255') lines.push(`alpha_mod=${alphaMod}`);
    if (colorMod !== '255,255,255') lines.push(`color_mod=${colorMod}`);
    lines.push('');
    lines.push('[stance]');
    lines.push(`frames=${frameCount}`);
    lines.push('position=0');
    lines.push(`duration=${duration}`);
    lines.push(`type=${animType}`);
    if (frameCount === 1) {
      lines.push(`frame=0,0,0,0,${frameW},${frameH},${offsetX},${offsetY}`);
    }
  } else {
    lines.push('[stance]');
    lines.push(`frames=${frameCount}`);
    lines.push('position=0');
    lines.push(`duration=${duration}`);
    lines.push(`type=${animType}`);
  }

  lines.push('');
  return lines.join('\n');
}
