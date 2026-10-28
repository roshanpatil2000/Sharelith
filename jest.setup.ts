jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Gesture Handler asks Worklets for the native UI runtime on import; there is
// none under Jest.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const store = new Map<string, string | number | boolean>();
    return {
      getString: (k: string) => store.get(k) as string | undefined,
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      remove: (k: string) => store.delete(k),
      clearAll: () => store.clear(),
      getAllKeys: () => [...store.keys()],
    };
  };
  return { createMMKV };
});

jest.mock('react-native-config', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
}));
