import React, { createContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { restaurantApi } from '../api/restaurantApi';
import { queryKeys } from '../api/queryClient';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [optimisticSavedIds, setOptimisticSavedIds] = useState(new Set());

  // TanStack Query for User Profile
  const {
    data: currentUser,
    isLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch {
        return null;
      }
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000,    // 60 minutes
    retry: false,
  });

  // TanStack Query for Saved Restaurants (runs only when authenticated)
  const { data: savedRestaurants = [] } = useQuery({
    queryKey: queryKeys.restaurants.saved,
    queryFn: async () => {
      try {
        return await restaurantApi.getSavedRestaurants();
      } catch {
        return [];
      }
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Sync saved place IDs derived from TanStack cache + optimistic updates
  const savedPlaceIds = useMemo(() => {
    const ids = new Set(optimisticSavedIds);
    if (Array.isArray(savedRestaurants)) {
      savedRestaurants.forEach((r) => {
        if (r.api_place_id) ids.add(r.api_place_id);
      });
    }
    return ids;
  }, [savedRestaurants, optimisticSavedIds]);

  const syncSavedPlaces = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.saved });
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    const result = await refetchProfile();
    await queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.saved });
    return result.data;
  }, [refetchProfile, queryClient]);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    queryClient.setQueryData(queryKeys.auth.profile, data.user);
    await queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.saved });
    await queryClient.invalidateQueries({ queryKey: queryKeys.lobbies.user });
    return data;
  };

  const register = async (userData) => {
    return authApi.register(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear(); // Safely clears in-memory query cache on logout
      setOptimisticSavedIds(new Set());
    }
  };

  const addSavedPlaceId = useCallback((placeId) => {
    setOptimisticSavedIds((prev) => new Set([...prev, placeId]));
  }, []);

  const removeSavedPlaceId = useCallback((placeId) => {
    setOptimisticSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(placeId);
      return next;
    });
    // Also remove from saved restaurants list in query cache if present
    queryClient.setQueryData(queryKeys.restaurants.saved, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter((r) => r.api_place_id !== placeId && r.id !== placeId);
    });
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser || null,
        isLoading,
        isAuthenticated: !!currentUser,
        savedPlaceIds,
        login,
        register,
        logout,
        refreshProfile,
        syncSavedPlaces,
        addSavedPlaceId,
        removeSavedPlaceId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

