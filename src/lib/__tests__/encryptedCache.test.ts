import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';
import { encryptedCacheStorage, randomKey, storage } from '../storage';

const created = createMMKV as unknown as jest.Mock;

it('makes 32-character random keys', () => {
  const a = randomKey();
  expect(a).toHaveLength(32);
  expect(randomKey()).not.toBe(a);
});

it('keeps the cache in an AES-256 file keyed from the Keychain, and drops the old plain copy', async () => {
  storage.set('query-cache', '{"old":"plain"}');
  storage.set('settings', 'kept');

  await encryptedCacheStorage.setItem('query-cache', '{"new":1}');
  expect(await encryptedCacheStorage.getItem('query-cache')).toBe('{"new":1}');

  // The old unencrypted copy is gone from the main file.
  expect(storage.getString('query-cache')).toBeUndefined();
  // Everything else in the main file survives the rebuild.
  expect(storage.getString('settings')).toBe('kept');

  const options = created.mock.calls.find(
    ([o]) => (o as { id?: string })?.id === 'sharelith-cache',
  )?.[0] as { encryptionKey: string; encryptionType: string };
  expect(options.encryptionType).toBe('AES-256');
  const saved = await Keychain.getGenericPassword({
    service: 'sharelith.cacheKey',
  });
  expect(saved && saved.password).toBe(options.encryptionKey);
  expect(options.encryptionKey).toHaveLength(32);

  await encryptedCacheStorage.removeItem('query-cache');
  expect(await encryptedCacheStorage.getItem('query-cache')).toBeNull();
});
