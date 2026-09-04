import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'],
  },
  restaurants: {
    search: (params) => ['restaurants', 'search', params],
    details: (placeId) => ['restaurants', 'details', placeId],
    saved: ['restaurants', 'saved'],
  },
  lobbies: {
    user: ['lobbies', 'user'],
    detail: (id) => ['lobbies', 'detail', id],
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes fresh
      gcTime: 30 * 60 * 1000,    // 30 minutes in-memory garbage collection
      refetchOnWindowFocus: false, // Prevent background refetches on alt-tab
      retry: 1,                    // Retry once on failure
    },
    mutations: {
      retry: 0,
    },
  },
});
