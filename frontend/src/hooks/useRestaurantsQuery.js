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

export function buildSearchQuery(query, cuisine, radius) {
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
    // For wide radiuses (> 2 miles), "best restaurants" enables Google's regional prominence
    // ranking across the full search circle, preventing tight clustering under 1.5 miles.
    // For tight radiuses (<= 2 miles), "restaurants" pairs with DISTANCE ranking for doorstep spots.
    finalQuery = (radius && Number(radius) > 2) ? 'best restaurants' : 'restaurants';
  }
  return finalQuery;
}

/**
 * Query hook for searching restaurants (nearby or text).
 * Caches results in memory for fast back/forward navigation.
 */
export function useRestaurantSearch({ query = '', cuisine = 'All Cuisines', radius = 5, latitude, longitude }, options = {}) {
  const finalKeyword = buildSearchQuery(query, cuisine, radius);
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
      let items = [];
      let nextPageToken = null;

      if (hasCoords) {
        const radiusNum = Number(radius || 5);
        const rankPreference = radiusNum <= 2 ? 'DISTANCE' : undefined;

        let currentToken = null;
        let pageCount = 0;

        // Fetch up to 3 pages until we pool at least 36 valid items within radius
        do {
          const pageData = await restaurantApi.searchNearby({
            latitude,
            longitude,
            radius: String(radiusNum),
            keyword: finalKeyword,
            rankPreference,
            ...(currentToken ? { pageToken: currentToken } : {}),
          });

          const pageList = Array.isArray(pageData) ? pageData : (pageData.restaurants || []);
          const existingIds = new Set(items.map((r) => r.api_place_id));

          for (const place of pageList) {
            if (place.api_place_id && !existingIds.has(place.api_place_id)) {
              const distanceMiles = calculateDistanceMiles(latitude, longitude, place.latitude, place.longitude);
              if (distanceMiles != null && distanceMiles <= radiusNum) {
                items.push({
                  ...place,
                  relevanceIndex: items.length,
                  distanceMiles,
                });
                existingIds.add(place.api_place_id);
              }
            }
          }

          currentToken = pageData.nextPageToken || null;
          pageCount += 1;
        } while (currentToken && items.length < 36 && pageCount < 3);
      } else {
        let currentToken = null;
        let pageCount = 0;

        do {
          const pageData = await restaurantApi.searchText(finalKeyword, {
            ...(currentToken ? { pageToken: currentToken } : {}),
          });

          const pageList = Array.isArray(pageData) ? pageData : (pageData.restaurants || []);
          const existingIds = new Set(items.map((r) => r.api_place_id));

          for (const place of pageList) {
            if (place.api_place_id && !existingIds.has(place.api_place_id)) {
              items.push({
                ...place,
                relevanceIndex: items.length,
                distanceMiles: null,
              });
              existingIds.add(place.api_place_id);
            }
          }

          currentToken = pageData.nextPageToken || null;
          pageCount += 1;
        } while (currentToken && items.length < 36 && pageCount < 3);
      }

      return items;
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
