import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { restaurantApi } from '../api/restaurantApi';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const syncSavedPlaces = useCallback(async () => {
    try {
      const savedList = await restaurantApi.getSavedRestaurants();
      const ids = new Set(savedList.map((r) => r.api_place_id));
      setSavedPlaceIds(ids);
    } catch {
      // Ignored if user not logged in
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const user = await authApi.getProfile();
      setCurrentUser(user);
      await syncSavedPlaces();
      return user;
    } catch {
      setCurrentUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [syncSavedPlaces]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    await refreshProfile();
    return data;
  };

  const register = async (userData) => {
    return authApi.register(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentUser(null);
      setSavedPlaceIds(new Set());
    }
  };

  const addSavedPlaceId = useCallback((placeId) => {
    setSavedPlaceIds((prev) => new Set([...prev, placeId]));
  }, []);

  const removeSavedPlaceId = useCallback((placeId) => {
    setSavedPlaceIds((prev) => {
      const next = new Set(prev);
      next.delete(placeId);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
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
