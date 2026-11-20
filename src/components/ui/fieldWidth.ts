/** Shared input/select widths so short values do not stretch across the screen. */
export const FIELD_WIDTH = {
  /** Numbers, levels, quantities. */
  num: 'w-20 max-w-full',
  /** Very short words, booleans, tiny enums. */
  short: 'w-28 max-w-full',
  /** Identifiers and codes. */
  id: 'w-36 max-w-full',
  /** Display names and ordinary text. Default for Input/Select. */
  name: 'w-44 max-w-full',
  /** Paths and other medium-long strings, capped. */
  path: 'w-full max-w-md',
  /** Search boxes and fields that must fill the row. */
  full: 'w-full',
} as const;

export type FieldWidth = keyof typeof FIELD_WIDTH;

export const DEFAULT_FIELD_WIDTH: FieldWidth = 'name';

export function fieldWidthClass(width: FieldWidth | undefined, type?: string): string {
  if (width) return FIELD_WIDTH[width];
  if (type === 'number') return FIELD_WIDTH.num;
  return FIELD_WIDTH[DEFAULT_FIELD_WIDTH];
}
