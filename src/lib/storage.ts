import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

export const storage = createMMKV({ id: 'sharelith' });

/** Adapter so Zustand's `persist` middleware can write to MMKV. */
export const zustandStorage: StateStorage = {
  getItem: name => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: name => {
    storage.remove(name);
  },
};

/** Async-shaped adapter for the TanStack Query persister. */
export const asyncStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => storage.set(key, value),
  removeItem: async (key: string) => {
    storage.remove(key);
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
