import * as Keychain from 'react-native-keychain';
import { secureStorage, storage } from '../storage';

const key = 'sb-test-auth-token';
const getGenericPassword = Keychain.getGenericPassword as jest.Mock;
const setGenericPassword = Keychain.setGenericPassword as jest.Mock;

afterEach(async () => {
  await secureStorage.removeItem(key);
});

describe('secureStorage', () => {
  it('keeps values out of MMKV', async () => {
    await secureStorage.setItem(key, 'session');
    expect(storage.getString(key)).toBeUndefined();
    expect(await secureStorage.getItem(key)).toBe('session');
  });

  it('removes values', async () => {
    await secureStorage.setItem(key, 'session');
    await secureStorage.removeItem(key);
    expect(await secureStorage.getItem(key)).toBeNull();
  });

  it('moves a session saved by an older version', async () => {
    storage.set(key, 'old-session');
    expect(await secureStorage.getItem(key)).toBe('old-session');
    expect(storage.getString(key)).toBeUndefined();
    expect(await secureStorage.getItem(key)).toBe('old-session');
  });

  it('keeps the old session if the Keychain read fails', async () => {
    storage.set(key, 'old-session');
    getGenericPassword.mockRejectedValueOnce(new Error('locked'));
    expect(await secureStorage.getItem(key)).toBe('old-session');
    expect(storage.getString(key)).toBe('old-session');
  });

  it('keeps the old session if moving it fails', async () => {
    storage.set(key, 'old-session');
    setGenericPassword.mockRejectedValueOnce(new Error('locked'));
    expect(await secureStorage.getItem(key)).toBe('old-session');
    expect(storage.getString(key)).toBe('old-session');
  });
});
