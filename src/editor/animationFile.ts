/** animations/*.txt (AnimationSet). Header image/render keys plus named sections. Unpacked sections use position+frames on a grid; packed sections list frame=index,direction,x,y,w,h,ox,oy[,image]. */

export const ANIMATIONS_DIR = 'animations';
export const ANIMATION_DIRECTIONS = 8;

export type AnimationImage = { file: string; id: string };

export type AnimationHeader = {
  images: AnimationImage[];
  render_size: string;
  render_offset: string;
  blend_mode: string;
  alpha_mod: string;
  color_mod: string;
  extra: Array<{ key: string; value: string }>;
};

export type PackedFrame = {
  index: string;
  direction: string;
  x: string;
  y: string;
  w: string;
  h: string;
  ox: string;
  oy: string;
  image: string;
};

export type AnimationSection = {
  name: string;
  position: string;
  frames: string;
  duration: string;
  type: string;
  active_frame: string;
  active_sub_frame: string;
  image: string;
  packed: PackedFrame[];
  extra: Array<{ key: string; value: string }>;
  comment: string;
};

export type AnimationFile = {
  header: string;
  headerKeys: AnimationHeader;
  sections: AnimationSection[];
};

export function emptyAnimationHeader(): AnimationHeader {
  return { images: [], render_size: '', render_offset: '', blend_mode: '', alpha_mod: '', color_mod: '', extra: [] };
}

export function emptyAnimationSection(name = 'stance'): AnimationSection {
  return {
    name,
    position: '',
    frames: '',
    duration: '',
    type: '',
    active_frame: '',
    active_sub_frame: '',
    image: '',
    packed: [],
    extra: [],
    comment: '',
  };
}

export function emptyAnimationFile(): AnimationFile {
  return { header: '', headerKeys: emptyAnimationHeader(), sections: [] };
}

export function animationRelPath(name: string): string {
  const slug = String(name || 'anim').trim().replace(/\\/g, '/').replace(/^\/*/, '').replace(/\.txt$/i, '').replace(/[^A-Za-z0-9._/-]+/g, '_') || 'anim';
  const rel = slug.startsWith(`${ANIMATIONS_DIR}/`) ? slug : `${ANIMATIONS_DIR}/${slug}`;
  return `${rel}.txt`;
}

export function parsePackedFrame(value: string): PackedFrame {
  const parts = String(value || '').split(',');
  const take = (i: number) => (parts[i] ?? '').trim();
  return {
    index: take(0),
    direction: take(1),
    x: take(2),
    y: take(3),
    w: take(4),
    h: take(5),
    ox: take(6),
    oy: take(7),
    image: parts.slice(8).join(',').trim(),
  };
}

export function serializePackedFrame(frame: PackedFrame): string {
  const fields = [frame.index, frame.direction, frame.x, frame.y, frame.w, frame.h, frame.ox, frame.oy];
  if (frame.image.trim()) fields.push(frame.image.trim());
  return fields.join(',');
}

export function parseAnimationFile(text: string): AnimationFile {
  const file = emptyAnimationFile();
  const header: string[] = [];
  let section: AnimationSection | null = null;
  let pending: string[] = [];
  let seenSection = false;

  const flush = () => {
    if (section) file.sections.push(section);
    section = null;
  };

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (!seenSection) header.push(raw);
      else pending.push(raw);
      continue;
    }
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      flush();
      seenSection = true;
      section = { ...emptyAnimationSection(sectionMatch[1]), comment: pending.join('\n').replace(/^\n+|\n+$/g, '') };
      pending = [];
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      if (!seenSection) header.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!section) {
      if (key === 'image') {
        const [img, ...rest] = value.split(',');
        file.headerKeys.images.push({ file: (img || '').trim(), id: rest.join(',').trim() });
      } else if (key === 'render_size') file.headerKeys.render_size = value;
      else if (key === 'render_offset') file.headerKeys.render_offset = value;
      else if (key === 'blend_mode') file.headerKeys.blend_mode = value;
      else if (key === 'alpha_mod') file.headerKeys.alpha_mod = value;
      else if (key === 'color_mod') file.headerKeys.color_mod = value;
      else file.headerKeys.extra.push({ key, value });
    } else if (key === 'position') section.position = value;
    else if (key === 'frames') section.frames = value;
    else if (key === 'duration') section.duration = value;
    else if (key === 'type') section.type = value;
    else if (key === 'active_frame') section.active_frame = value;
    else if (key === 'active_sub_frame') section.active_sub_frame = value;
    else if (key === 'image') section.image = value;
    else if (key === 'frame') section.packed.push(parsePackedFrame(value));
    else section.extra.push({ key, value });
  }
  flush();
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emit(key: string, value: string): string | null {
  return value.trim() ? `${key}=${value}` : null;
}

export function serializeAnimationFile(file: AnimationFile, previous = ''): string {
  const header = (file.header || (previous ? parseAnimationFile(previous).header : '')).replace(/\n+$/, '');
  const keys = file.headerKeys || emptyAnimationHeader();
  const globalLines = [
    ...keys.images.filter((row) => row.file.trim()).map((row) => (row.id.trim() ? `image=${row.file.trim()},${row.id.trim()}` : `image=${row.file.trim()}`)),
    emit('render_size', keys.render_size),
    emit('render_offset', keys.render_offset),
    emit('blend_mode', keys.blend_mode),
    emit('alpha_mod', keys.alpha_mod),
    emit('color_mod', keys.color_mod),
    ...keys.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
  ].filter((line): line is string => Boolean(line));

  const parts: string[] = [];
  if (header) parts.push(header);
  if (globalLines.length) parts.push(globalLines.join('\n'));
  for (const section of file.sections) {
    if (!section.name.trim()) continue;
    const lines = [
      section.comment ? section.comment.replace(/\n+$/, '') : '',
      `[${section.name.trim()}]`,
      emit('position', section.position),
      emit('frames', section.frames),
      emit('duration', section.duration),
      emit('type', section.type),
      emit('active_frame', section.active_frame),
      emit('active_sub_frame', section.active_sub_frame),
      emit('image', section.image),
      ...section.packed.map((frame) => `frame=${serializePackedFrame(frame)}`),
      ...section.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
    ].filter((line): line is string => Boolean(line));
    parts.push(lines.join('\n'));
  }
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}

export function parseSize(value: string): { w: number; h: number } {
  const [w, h] = String(value || '').split(',').map((part) => parseInt(part.trim(), 10) || 0);
  return { w: w || 0, h: h || 0 };
}

export function parseDurationMs(raw: string): number {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 1000;
  if (trimmed.endsWith('ms')) return parseFloat(trimmed) || 1000;
  if (trimmed.endsWith('s')) return (parseFloat(trimmed) || 1) * 1000;
  const ticks = parseInt(trimmed, 10);
  return ticks > 0 ? ticks * (1000 / 60) : 1000;
}

export type PreviewRect = { x: number; y: number; w: number; h: number; image: string; ox: number; oy: number };

export function parseColorMod(value: string): { r: number; g: number; b: number } {
  const parts = String(value || '').split(',').map((part) => parseInt(part.trim(), 10));
  return {
    r: Number.isFinite(parts[0]) ? parts[0] : 255,
    g: Number.isFinite(parts[1]) ? parts[1] : 255,
    b: Number.isFinite(parts[2]) ? parts[2] : 255,
  };
}

export function parseOffsetPair(value: string): { x: number; y: number } {
  const [x, y] = String(value || '').split(',').map((part) => parseInt(part.trim(), 10) || 0);
  return { x, y };
}

/** Canvas placement for a frame: dest = origin - offset, as Flare draws at position - render_offset. */
export function previewLayout(rect: Pick<PreviewRect, 'w' | 'h' | 'ox' | 'oy'>): {
  canvasW: number; canvasH: number; originX: number; originY: number; destX: number; destY: number;
} {
  const originX = Math.max(rect.ox, 0);
  const originY = Math.max(rect.oy, 0);
  const destX = originX - rect.ox;
  const destY = originY - rect.oy;
  return {
    canvasW: Math.max(destX + rect.w, originX + 1),
    canvasH: Math.max(destY + rect.h, originY + 1),
    originX,
    originY,
    destX,
    destY,
  };
}

/** Sprite rectangle and render offset for one frame of a section, unpacked grid or packed frame= row. */
export function previewRect(file: AnimationFile, section: AnimationSection, frameIndex: number, direction: number): PreviewRect | null {
  const packed = section.packed.find((frame) => parseInt(frame.index, 10) === frameIndex && parseInt(frame.direction, 10) === direction);
  if (packed) {
    const imageId = packed.image.trim() || section.image.trim();
    const image = file.headerKeys.images.find((row) => row.id && row.id === imageId)?.file
      || file.headerKeys.images[0]?.file
      || '';
    const w = parseInt(packed.w, 10) || 0;
    const h = parseInt(packed.h, 10) || 0;
    if (!w || !h || !image) return null;
    return {
      x: parseInt(packed.x, 10) || 0,
      y: parseInt(packed.y, 10) || 0,
      w,
      h,
      image,
      ox: parseInt(packed.ox, 10) || 0,
      oy: parseInt(packed.oy, 10) || 0,
    };
  }
  const size = parseSize(file.headerKeys.render_size);
  if (!size.w || !size.h) return null;
  const position = parseInt(section.position, 10) || 0;
  const imageId = section.image.trim();
  const image = file.headerKeys.images.find((row) => row.id && row.id === imageId)?.file
    || file.headerKeys.images[0]?.file
    || '';
  if (!image) return null;
  const offset = parseOffsetPair(file.headerKeys.render_offset);
  return {
    x: size.w * (position + frameIndex),
    y: size.h * direction,
    w: size.w,
    h: size.h,
    image,
    ox: offset.x,
    oy: offset.y,
  };
}

