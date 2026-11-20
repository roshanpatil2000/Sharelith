import * as Keychain from 'react-native-keychain';
import {
  createMMKV,
  deleteMMKV,
  existsMMKV,
  type MMKV,
} from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * Small app settings. Older versions also kept the offline cache here,
 * unencrypted, in the "sharelith" file. Removing a key doesn't erase its
 * bytes from an MMKV file, so the settings move to a new file and the old
 * file is deleted.
 */
function openMainStore(): MMKV {
  const store = createMMKV({ id: 'sharelith-main' });
  if (existsMMKV('sharelith')) {
    try {
      const old = createMMKV({ id: 'sharelith' });
      // Drop it before copying, so the cache never reaches the new file.
      old.remove('query-cache');
      store.importAllFrom(old);
    } finally {
      deleteMMKV('sharelith');
    }
  }
  return store;
}

export const storage = openMainStore();

/** Adapter so Zustand's `persist` middleware can write to MMKV. */
export const zustandStorage: StateStorage = {
  getItem: name => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: name => {
    storage.remove(name);
  },
};

const keychainService = (key: string) => `sharelith.${key}`;

/**
 * Keychain-backed adapter for Supabase auth, so refresh tokens aren't stored
 * in plain text. Sessions saved in MMKV by older versions move across on first
 * read, and stay in MMKV if that fails, so a Keychain error can't log anyone
 * out.
 */
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const legacy = storage.getString(key) ?? null;
    try {
      const saved = await Keychain.getGenericPassword({
        service: keychainService(key),
      });
      if (saved) {
        return saved.password;
      }
      if (legacy !== null) {
        await secureStorage.setItem(key, legacy);
      }
    } catch {
      // Fall back to the copy in MMKV, if any.
    }
    return legacy;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Keychain.setGenericPassword('session', value, {
      service: keychainService(key),
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    storage.remove(key);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.remove(key);
    await Keychain.resetGenericPassword({ service: keychainService(key) });
  },
};

/** A 32-character key from the platform's secure random generator. */
export function randomKey(): string {
  const bytes = new Uint8Array(24);
  // Provided by react-native-get-random-values (imported in index.js).
  (
    globalThis as unknown as {
      crypto: { getRandomValues: (a: Uint8Array) => Uint8Array };
    }
  ).crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .slice(0, 32);
}

let cacheStore: Promise<MMKV | null> | null = null;

/**
 * The offline cache (balances, expenses, names) lives in its own MMKV file,
 * encrypted with AES-256. The key is generated on this device and kept in
 * the Keychain / Android Keystore. If the Keychain can't be used, nothing is
 * written to disk: the app just loads fresh data each launch.
 */
function openCacheStore(): Promise<MMKV | null> {
  cacheStore ??= (async () => {
    try {
      const service = keychainService('cacheKey');
      const saved = await Keychain.getGenericPassword({ service });
      let key = saved ? saved.password : null;
      if (!key) {
        key = randomKey();
        await Keychain.setGenericPassword('cache', key, {
          service,
          accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
      }
      return createMMKV({
        id: 'sharelith-cache',
        encryptionKey: key,
        encryptionType: 'AES-256',
      });
    } catch {
      return null;
    }
  })();
  return cacheStore;
}

/** Async-shaped, encrypted adapter for the TanStack Query persister. */
export const encryptedCacheStorage = {
  getItem: async (key: string) => {
    const store = await openCacheStore();
    try {
      return store?.getString(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    (await openCacheStore())?.set(key, value);
  },
  removeItem: async (key: string) => {
    (await openCacheStore())?.remove(key);
  },
};
