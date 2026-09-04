import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantApi } from '../api/restaurantApi';
import { queryKeys } from '../api/queryClient';

export function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function buildSearchQuery(query, cuisine) {
  const queryParts = [];
  if (cuisine && cuisine !== 'All Cuisines') queryParts.push(cuisine);
  if (query && query.trim()) queryParts.push(query.trim());

  let finalQuery = queryParts.join(' ');
  if (cuisine && cuisine !== 'All Cuisines' && (!query || !query.trim())) {
    if (!/restaurant|food|cafe|bakery|bbq|pizza|burger|sushi|ramen/i.test(cuisine)) {
      finalQuery = `${cuisine} restaurant`;
    }
  }
  if (!finalQuery.trim()) {
    finalQuery = 'restaurant';
  }
  return finalQuery;
}

/**
 * Query hook for searching restaurants (nearby or text).
 * Caches results in memory for fast back/forward navigation.
 */
export function useRestaurantSearch({ query = '', cuisine = 'All Cuisines', radius = 5, latitude, longitude }, options = {}) {
  const finalKeyword = buildSearchQuery(query, cuisine);
  const hasCoords = latitude != null && longitude != null;

  const searchParamsKey = {
    keyword: finalKeyword,
    radius: hasCoords ? Number(radius) : undefined,
    latitude: hasCoords ? Number(latitude) : undefined,
    longitude: hasCoords ? Number(longitude) : undefined,
  };

  return useQuery({
    queryKey: queryKeys.restaurants.search(searchParamsKey),
    queryFn: async () => {
      let data = [];
      if (hasCoords) {
        data = await restaurantApi.searchNearby({
          latitude,
          longitude,
          radius: String(radius || 5),
          keyword: finalKeyword,
        });

        data = data.map((place) => ({
          ...place,
          distanceMiles: calculateDistanceMiles(latitude, longitude, place.latitude, place.longitude),
        }));

        data.sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
      } else {
        data = await restaurantApi.searchText(finalKeyword);
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
    ...options,
  });
}

/**
 * Query hook for fetching details of a specific restaurant.
 * Reopening an already loaded restaurant modal renders instantly without network calls.
 */
export function useRestaurantDetails(placeId, options = {}) {
  return useQuery({
    queryKey: queryKeys.restaurants.details(placeId),
    queryFn: () => restaurantApi.getDetails(placeId),
    enabled: !!placeId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 60 minutes
    ...options,
  });
}

/**
 * Query hook for the user's saved restaurants list.
 */
export function useSavedRestaurants(options = {}) {
  return useQuery({
    queryKey: queryKeys.restaurants.saved,
    queryFn: () => restaurantApi.getSavedRestaurants(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

/**
 * Mutation hook for saving a restaurant.
 * Automatically invalidates saved restaurants query and updates cache.
 */
export function useSaveRestaurantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (restaurantData) => restaurantApi.saveRestaurant(restaurantData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.saved });
    },
  });
}

/**
 * Mutation hook for unsaving a restaurant.
 */
export function useUnsaveRestaurantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (restaurantId) => restaurantApi.unsaveRestaurant(restaurantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.saved });
    },
  });
}
