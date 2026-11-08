/** After deleting a map: is the project now empty (go to the "Create a map" state)? */
export function remainingMapsAfterDelete(listed: string[], deletedName: string, sanitize: (n: string) => string = defaultSanitize): string[] {
  const del = sanitize(deletedName);
  return listed.filter(m => sanitize(m.replace(/\.(txt|json)$/i, '')) !== del);
}

export function isProjectEmptyAfterDelete(listed: string[], deletedName: string): boolean {
  return remainingMapsAfterDelete(listed, deletedName).length === 0;
}

function defaultSanitize(n: string): string {
  return n.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
}
