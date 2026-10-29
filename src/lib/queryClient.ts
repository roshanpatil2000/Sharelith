import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { asyncStorage } from './storage';

// React Native has no window focus events: treat returning to the foreground
// as "focus" so stale queries (e.g. the profile) refetch.
if (Platform.OS !== 'web') {
  focusManager.setEventListener(handleFocus => {
    const sub = AppState.addEventListener('change', state => {
      handleFocus(state === 'active');
    });
    return () => sub.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep data around long enough to be persisted and shown offline.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: asyncStorage,
  key: 'query-cache',
  throttleTime: 1000,
});
