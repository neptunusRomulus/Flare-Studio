/** First text value of a map-object property bag. */
export function propertyText(value: string | string[] | null | undefined, fallback = ''): string {
  const text = Array.isArray(value) ? value[0] : value;
  if (text == null || text === '') return fallback;
  return text;
}

/** Copy a property bag into a string record, reading each value as text. */
export function propertyRecord(
  value: Record<string, string | string[]> | null | undefined
): Record<string, string> {
  const record: Record<string, string> = {};
  if (!value) return record;
  for (const [key, entry] of Object.entries(value)) {
    record[key] = propertyText(entry);
  }
  return record;
}
