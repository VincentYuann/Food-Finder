import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { lobbyApi } from '../api/lobbyApi';
import { queryKeys } from '../api/queryClient';

/**
 * Query hook for user's lobbies.
 */
export function useUserLobbies(options = {}) {
  return useQuery({
    queryKey: queryKeys.lobbies.user,
    queryFn: async () => {
      const memberships = await authApi.getUserLobbies();
      return memberships.map((m) => m.lobby).filter(Boolean);
    },
    staleTime: 2 * 60 * 1000,  // 2 minutes
    gcTime: 15 * 60 * 1000,
    ...options,
  });
}

/**
 * Mutation hooks for creating and joining lobbies.
 */
export function useCreateLobbyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name) => lobbyApi.createLobby(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lobbies.user });
    },
  });
}

export function useJoinLobbyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code) => lobbyApi.joinLobby(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lobbies.user });
    },
  });
}
