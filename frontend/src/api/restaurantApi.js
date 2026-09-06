import { apiClient } from './client';

export const restaurantApi = {
  async searchNearby({ latitude, longitude, radius, keyword, pageToken, rankPreference }) {
    const { data } = await apiClient.get('/api/restaurants/search/nearby', {
      params: {
        latitude,
        longitude,
        radius: radius || '5',
        keyword: keyword || 'restaurant',
        ...(rankPreference ? { rankPreference } : {}),
        ...(pageToken ? { pageToken } : {}),
      },
    });
    if (Array.isArray(data)) {
      return { restaurants: data, nextPageToken: null };
    }
    return {
      restaurants: data.restaurants || [],
      nextPageToken: data.nextPageToken || null,
    };
  },

  async searchText(query, { latitude, longitude, pageToken } = {}) {
    const { data } = await apiClient.get('/api/restaurants/search/text', {
      params: {
        query: query || 'restaurant',
        ...(latitude != null ? { latitude } : {}),
        ...(longitude != null ? { longitude } : {}),
        ...(pageToken ? { pageToken } : {}),
      },
    });
    if (Array.isArray(data)) {
      return { restaurants: data, nextPageToken: null };
    }
    return {
      restaurants: data.restaurants || [],
      nextPageToken: data.nextPageToken || null,
    };
  },

  async getSavedRestaurants() {
    const { data } = await apiClient.get('/api/restaurants/saved');
    return data;
  },

  async saveRestaurant(restaurantData) {
    try {
      const { data } = await apiClient.post('/api/restaurants/save', restaurantData);
      return data;
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('already')) {
        return { message: 'Already saved' };
      }
      throw err;
    }
  },

  async unsaveRestaurant(restaurantId) {
    const { data } = await apiClient.delete(`/api/restaurants/saved/${restaurantId}`);
    return data;
  },

  async getDetails(placeId) {
    const { data } = await apiClient.get(`/api/restaurants/details/${placeId}`);
    return data;
  },
};

