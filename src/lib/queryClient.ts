import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { asyncStorage } from './storage';

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
