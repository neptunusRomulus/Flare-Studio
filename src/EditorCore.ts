export interface Npc {
  name: string;
}

export interface Item {
  id: number;
}

export type EntityKey = string | number;

export type CoreChange =
  | { type: 'add'; entityKind: string; key: EntityKey }
  | { type: 'update'; entityKind: string; key: EntityKey }
  | { type: 'remove'; entityKind: string; key: EntityKey };

export type EditorCoreErrorCode = 'INVALID_KEY' | 'DUPLICATE_KEY' | 'NOT_FOUND';

export class EditorCoreError extends Error {
  public readonly code: EditorCoreErrorCode;
  public readonly entityKind: string;
  public readonly key: unknown;

  constructor(code: EditorCoreErrorCode, entityKind: string, key: unknown, message: string) {
    super(message);
    this.name = 'EditorCoreError';
    this.code = code;
    this.entityKind = entityKind;
    this.key = key;
  }
}

export interface EntityRepository<TEntity, TKey extends EntityKey> {
  add(entity: TEntity): void;
  update(key: TKey, nextEntity: TEntity): void;
  remove(key: TKey): void;
  has(key: TKey): boolean;
  getAll(): ReadonlyArray<Readonly<TEntity>>;
  getByKey(key: TKey): Readonly<TEntity> | null;
}

export interface EditorCoreInit<TNpc extends Npc, TItem extends Item> {
  npcs?: Iterable<TNpc>;
  items?: Iterable<TItem>;
}

type KeyNormalizer<TKey extends EntityKey> = (key: TKey) => TKey;

interface EntityStoreOptions<TEntity, TKey extends EntityKey> {
  kind: string;
  getKey: (entity: Readonly<TEntity>) => TKey;
  normalizeKey?: KeyNormalizer<TKey>;
  onChange?: (change: CoreChange) => void;
}

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const freezeShallow = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object') return Object.freeze(value) as Readonly<T>;
  return value as Readonly<T>;
};

const freezeArray = <T>(values: T[]): ReadonlyArray<T> => Object.freeze(values);

const assertValidKey = (entityKind: string, key: EntityKey): void => {
  if (typeof key === 'string') {
    if (key.trim().length === 0) {
      throw new EditorCoreError('INVALID_KEY', entityKind, key, `${entityKind} key must be a non-empty string.`);
    }
    return;
  }

  if (!Number.isFinite(key) || !Number.isSafeInteger(key)) {
    throw new EditorCoreError('INVALID_KEY', entityKind, key, `${entityKind} key must be a finite safe integer.`);
  }
};

class EntityStore<TEntity, TKey extends EntityKey> implements EntityRepository<TEntity, TKey> {
  private readonly kind: string;
  private readonly getKey: (entity: Readonly<TEntity>) => TKey;
  private readonly normalizeKey: KeyNormalizer<TKey>;
  private readonly onChange?: (change: CoreChange) => void;
  private readonly byKey = new Map<TKey, TEntity>();

  constructor(options: EntityStoreOptions<TEntity, TKey>, initial?: Iterable<TEntity>) {
    this.kind = options.kind;
    this.getKey = options.getKey;
    this.normalizeKey = options.normalizeKey ?? (k => k);
    this.onChange = options.onChange;

    if (initial) {
      for (const entity of initial) this.add(entity);
    }
  }

  add(entity: TEntity): void {
    const key = this.normalizeKey(this.getKey(entity));
    assertValidKey(this.kind, key);
    if (this.byKey.has(key)) {
      throw new EditorCoreError('DUPLICATE_KEY', this.kind, key, `${this.kind} with key '${String(key)}' already exists.`);
    }
    this.byKey.set(key, deepClone(entity));
    this.onChange?.({ type: 'add', entityKind: this.kind, key });
  }

  update(key: TKey, nextEntity: TEntity): void {
    const normalizedCurrentKey = this.normalizeKey(key);
    assertValidKey(this.kind, normalizedCurrentKey);

    if (!this.byKey.has(normalizedCurrentKey)) {
      throw new EditorCoreError('NOT_FOUND', this.kind, normalizedCurrentKey, `${this.kind} with key '${String(normalizedCurrentKey)}' was not found.`);
    }

    const normalizedNextKey = this.normalizeKey(this.getKey(nextEntity));
    assertValidKey(this.kind, normalizedNextKey);

    const keyChanged = normalizedNextKey !== normalizedCurrentKey;
    if (keyChanged && this.byKey.has(normalizedNextKey)) {
      throw new EditorCoreError('DUPLICATE_KEY', this.kind, normalizedNextKey, `${this.kind} with key '${String(normalizedNextKey)}' already exists.`);
    }

    if (keyChanged) this.byKey.delete(normalizedCurrentKey);
    this.byKey.set(normalizedNextKey, deepClone(nextEntity));
    this.onChange?.({ type: 'update', entityKind: this.kind, key: normalizedNextKey });
  }

  remove(key: TKey): void {
    const normalizedKey = this.normalizeKey(key);
    assertValidKey(this.kind, normalizedKey);

    const deleted = this.byKey.delete(normalizedKey);
    if (!deleted) {
      throw new EditorCoreError('NOT_FOUND', this.kind, normalizedKey, `${this.kind} with key '${String(normalizedKey)}' was not found.`);
    }
    this.onChange?.({ type: 'remove', entityKind: this.kind, key: normalizedKey });
  }

  has(key: TKey): boolean {
    const normalizedKey = this.normalizeKey(key);
    assertValidKey(this.kind, normalizedKey);
    return this.byKey.has(normalizedKey);
  }

  getAll(): ReadonlyArray<Readonly<TEntity>> {
    const snapshot = Array.from(this.byKey.values(), entity => freezeShallow(deepClone(entity)));
    return freezeArray(snapshot);
  }

  getByKey(key: TKey): Readonly<TEntity> | null {
    const normalizedKey = this.normalizeKey(key);
    assertValidKey(this.kind, normalizedKey);

    const entity = this.byKey.get(normalizedKey);
    if (!entity) return null;
    return freezeShallow(deepClone(entity));
  }
}

export class EditorCore<TNpc extends Npc = Npc, TItem extends Item = Item> {
  public readonly npcs: EntityRepository<TNpc, string>;
  public readonly items: EntityRepository<TItem, number>;
  // Optional hook for UI / persistence layers to react to data changes without putting any UI state into the core.
  public onChange?: (change: CoreChange) => void;

  constructor(initial?: EditorCoreInit<TNpc, TItem>) {
    // Extension point: add new entity repositories here (Quest, Power, Event, Script, Enemy).
    // - Define a new base interface (e.g. `Quest { id: string }`)
    // - Create a new `EntityStore<Quest, string>({ kind: 'Quest', getKey: q => q.id })`
    // - Expose it as `public readonly quests: EntityRepository<Quest, string>`
    const emitChange = (change: CoreChange): void => {
      this.onChange?.(change);
    };

    const npcStore = new EntityStore<TNpc, string>({ kind: 'NPC', getKey: npc => npc.name, onChange: emitChange }, initial?.npcs);
    const itemStore = new EntityStore<TItem, number>({ kind: 'Item', getKey: item => item.id, onChange: emitChange }, initial?.items);

    this.npcs = npcStore;
    this.items = itemStore;
  }
}
