import { apiClient } from './client';

export const restaurantApi = {
  async searchNearby({ latitude, longitude, radius, keyword }) {
    const { data } = await apiClient.get('/api/restaurants/search/nearby', {
      params: {
        latitude,
        longitude,
        radius: radius || '5',
        keyword: keyword || 'restaurant',
      },
    });
    return data;
  },

  async searchText(query) {
    const { data } = await apiClient.get('/api/restaurants/search/text', {
      params: {
        query: query || 'restaurant',
      },
    });
    return data;
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

