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

jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlock' },
    getGenericPassword: jest.fn(async ({ service }: { service: string }) => {
      const password = store.get(service);
      return password === undefined ? false : { password };
    }),
    setGenericPassword: jest.fn(
      async (_user: string, password: string, o: { service: string }) => {
        store.set(o.service, password);
        return { service: o.service };
      },
    ),
    resetGenericPassword: jest.fn(async ({ service }: { service: string }) =>
      store.delete(service),
    ),
  };
});

// The real persister saves on a 1-second throttle into storage shared by every
// test in a file, so on a slow machine one test restores another's cached data.
jest.mock('@tanstack/query-async-storage-persister', () => ({
  createAsyncStoragePersister: () => ({
    persistClient: async () => {},
    restoreClient: async () => undefined,
    removeClient: async () => {},
  }),
}));

jest.mock('react-native-config', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
}));

jest.mock('@/lib/supabase', () => ({
  supabase: require('./src/test/supabaseMock').supabaseMock,
}));

jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(async () => ({
      available: true,
      biometryType: 'FaceID',
    })),
    simplePrompt: jest.fn(async () => ({ success: true })),
  })),
);

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));

beforeEach(() => {
  // Each test starts signed out with an empty query cache.
  const { useAuthStore } = require('@/features/auth/authStore');
  useAuthStore.setState({ session: null, ready: false, recovering: false });
  require('@/lib/queryClient').queryClient.clear();
});

// Queries hold 24-hour gcTime timers; don't let them keep Jest alive.
// React Native's types say timers are numbers, but under Jest they're Node's.
const unref = <T>(timer: T): T => {
  (timer as { unref: () => void }).unref();
  return timer;
};
require('@tanstack/react-query').timeoutManager.setTimeoutProvider({
  setTimeout: (callback: () => void, delay: number) =>
    unref(setTimeout(callback, delay)),
  clearTimeout,
  setInterval: (callback: () => void, delay: number) =>
    unref(setInterval(callback, delay)),
  clearInterval,
});

// toAppError logs raw auth errors in dev; keep test output clean.
const originalWarn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  if (args[0] === '[auth]') {
    return;
  }
  originalWarn(...args);
});

// Cached queries hold their 24-hour gcTime timers, which would keep Jest alive.
afterAll(() => {
  require('@/lib/queryClient').queryClient.clear();
});
