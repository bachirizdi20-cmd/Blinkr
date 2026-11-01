export const LIBRARY_STORAGE_FIELDS = [
  "watchlist",
  "diary",
  "lists",
  "likes",
  "profile",
  "episodes",
] as const;

export type LibraryStorageField = (typeof LIBRARY_STORAGE_FIELDS)[number];
export type LibraryStorageKeys = Record<LibraryStorageField, string>;
export type LibraryStorageValues = Record<LibraryStorageField, string | null>;

export interface LibraryKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

const LEGACY_LIBRARY_STORAGE_KEYS: LibraryStorageKeys = {
  watchlist: "@reelog/watchlist",
  diary: "@reelog/diary",
  lists: "@reelog/lists",
  likes: "@reelog/likes",
  profile: "@reelog/profile",
  episodes: "@reelog/episodes",
};

const LEGACY_MIGRATION_MARKER = "@blinkr/library/v2/legacy-imported";
const MIGRATION_LOCK_NAME = "blinkr-library-legacy-migration-v2";
const LOCK_DATABASE_NAME = "blinkr-legacy-migration-v1";
const LOCK_STORE_NAME = "migration-state";
const LEGACY_OWNER_KEY = "legacy-library-owner";
let migrationQueue: Promise<void> = Promise.resolve();

type BrowserLockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

function withModuleMigrationLock<T>(callback: () => Promise<T>): Promise<T> {
  const previous = migrationQueue;
  let release!: () => void;
  migrationQueue = new Promise<void>((resolve) => { release = resolve; });
  return previous.then(callback).finally(() => release());
}

function openLockDatabase(): Promise<IDBDatabase> {
  const indexedDBFactory = (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  if (!indexedDBFactory) return Promise.reject(new Error("Safe browser migration lock is unavailable"));

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(LOCK_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCK_STORE_NAME)) {
        database.createObjectStore(LOCK_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser migration lock"));
  });
}

function claimIndexedDbMigrationOwner(accountId: string): Promise<boolean> {
  return openLockDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCK_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCK_STORE_NAME);
    const request = store.get(LEGACY_OWNER_KEY);
    let ownsLegacyData = false;

    request.onsuccess = () => {
      const currentOwner = request.result as string | undefined;
      if (currentOwner === undefined) {
        // IDB readwrite transactions serialize across tabs; this put is the atomic first-owner claim.
        store.put(accountId, LEGACY_OWNER_KEY);
        ownsLegacyData = true;
      } else {
        ownsLegacyData = currentOwner === accountId;
      }
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(ownsLegacyData);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not claim legacy library owner"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Legacy library owner transaction aborted"));
    };
  }));
}

async function withMigrationLock(accountId: string, callback: () => Promise<void>): Promise<void> {
  const lockManager = (globalThis as unknown as {
    navigator?: { locks?: BrowserLockManager };
  }).navigator?.locks;
  if (typeof document !== "undefined") {
    let ownsLegacyData: boolean;
    try {
      ownsLegacyData = await claimIndexedDbMigrationOwner(accountId);
    } catch (error) {
      if (!lockManager) throw error;
      // Web Locks still provide a safe serialized fallback if IndexedDB is unavailable.
      await lockManager.request(MIGRATION_LOCK_NAME, callback);
      return;
    }
    if (!ownsLegacyData) return;
    if (lockManager) await lockManager.request(MIGRATION_LOCK_NAME, callback);
    else await callback();
    return;
  }
  if (lockManager) {
    await lockManager.request(MIGRATION_LOCK_NAME, callback);
    return;
  }
  await withModuleMigrationLock(callback);
}

export function getAccountLibraryStorageKeys(accountId: string): LibraryStorageKeys {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw new Error("A Blinkr account ID is required for library storage");

  const accountKey = encodeURIComponent(normalizedAccountId);
  const prefix = `@blinkr/library/v2/${accountKey}`;
  return Object.fromEntries(
    LIBRARY_STORAGE_FIELDS.map((field) => [field, `${prefix}/${field}`]),
  ) as LibraryStorageKeys;
}

async function migrateLegacyLibrary(
  storage: LibraryKeyValueStorage,
  accountId: string,
  accountKeys: LibraryStorageKeys,
): Promise<void> {
  const marker = await storage.getItem(LEGACY_MIGRATION_MARKER);
  const claim = `claimed:${accountId}`;

  if (marker === "done" || (marker !== null && marker !== claim)) return;
  if (marker === null) {
    // Claim ownership before reading/copying so another account can never import the same legacy data.
    await storage.setItem(LEGACY_MIGRATION_MARKER, claim);
  }

  const [legacyValues, currentValues] = await Promise.all([
    Promise.all(LIBRARY_STORAGE_FIELDS.map((field) => storage.getItem(LEGACY_LIBRARY_STORAGE_KEYS[field]))),
    Promise.all(LIBRARY_STORAGE_FIELDS.map((field) => storage.getItem(accountKeys[field]))),
  ]);

  for (let index = 0; index < LIBRARY_STORAGE_FIELDS.length; index += 1) {
    const field = LIBRARY_STORAGE_FIELDS[index];
    const legacyValue = legacyValues[index];
    if (currentValues[index] === null && legacyValue !== null) {
      await storage.setItem(accountKeys[field], legacyValue);
    }
  }

  // Remove old global keys only after every needed copy has succeeded.
  await storage.multiRemove(LIBRARY_STORAGE_FIELDS.map((field) => LEGACY_LIBRARY_STORAGE_KEYS[field]));
  await storage.setItem(LEGACY_MIGRATION_MARKER, "done");
}

/**
 * Loads one account's local library. The old, unscoped keys are claimed and
 * imported once into the first authenticated account that opens this version.
 * Existing account-scoped values are never overwritten; failed imports can be
 * retried by the account that claimed them without exposing them to another.
 */
export async function loadAccountLibraryStorage(
  storage: LibraryKeyValueStorage,
  accountId: string,
): Promise<{ keys: LibraryStorageKeys; values: LibraryStorageValues }> {
  const keys = getAccountLibraryStorageKeys(accountId);
  await withMigrationLock(accountId, () => migrateLegacyLibrary(storage, accountId, keys));

  const values = await Promise.all(LIBRARY_STORAGE_FIELDS.map((field) => storage.getItem(keys[field])));
  return {
    keys,
    values: Object.fromEntries(
      LIBRARY_STORAGE_FIELDS.map((field, index) => [field, values[index]]),
    ) as LibraryStorageValues,
  };
}
