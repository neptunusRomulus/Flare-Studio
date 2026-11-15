export const MARKER_NAME: string;
export const LEGACY_APP_DIR_NAME: string;

export function isMissingOrEmptyDir(dir: string): boolean;

export function migrateUserData(opts: {
  newDir: string;
  oldDir: string;
  markerName?: string;
}): {
  migrated: boolean;
  skipped?: string;
  errors: Array<{ path: string; error: unknown }>;
};

export function migrateUserDataFromLegacyName(app: { getPath: (name: string) => string }): {
  migrated: boolean;
  skipped?: string;
  errors: Array<{ path: string; error: unknown }>;
};
