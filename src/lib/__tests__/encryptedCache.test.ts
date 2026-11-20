import * as Keychain from 'react-native-keychain';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';

const created = createMMKV as unknown as jest.Mock;

it('makes 32-character random keys', () => {
  const { randomKey } = require('../storage') as typeof import('../storage');
  const a = randomKey();
  expect(a).toHaveLength(32);
  expect(randomKey()).not.toBe(a);
});

it('keeps the cache in an AES-256 file keyed from the Keychain', async () => {
  const { encryptedCacheStorage } =
    require('../storage') as typeof import('../storage');
  await encryptedCacheStorage.setItem('query-cache', '{"new":1}');
  expect(await encryptedCacheStorage.getItem('query-cache')).toBe('{"new":1}');

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

it('moves settings out of the old file, leaves the plain cache behind, and deletes the file', () => {
  jest.isolateModules(() => {
    (existsMMKV as jest.Mock).mockReturnValueOnce(true);
    const oldKeys = new Set(['settings', 'query-cache']);
    const old = {
      getAllKeys: () => [...oldKeys],
      getString: (k: string) => `${k}-value`,
      remove: (k: string) => oldKeys.delete(k),
    };
    const realCreate = created.getMockImplementation()!;
    created.mockImplementation((o?: { id?: string }) =>
      o?.id === 'sharelith' ? old : realCreate(o),
    );
    const { storage } = require('../storage') as typeof import('../storage');
    created.mockImplementation(realCreate);
    expect(storage.getString('settings')).toBe('settings-value');
    expect(storage.getString('query-cache')).toBeUndefined();
    expect(deleteMMKV).toHaveBeenCalledWith('sharelith');
  });
});
