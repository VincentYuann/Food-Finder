import { apiFetch, errorFrom } from './client';

export const restaurantApi = {
  async searchNearby({ latitude, longitude, radius, keyword }) {
    const params = new URLSearchParams({
      latitude,
      longitude,
      radius: radius || '5',
      keyword: keyword || 'restaurant',
    });
    const response = await apiFetch(`/api/restaurants/search/nearby?${params}`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Nearby search failed'));
    }
    return response.json();
  },

  async searchText(query) {
    const params = new URLSearchParams({ query: query || 'restaurant' });
    const response = await apiFetch(`/api/restaurants/search/text?${params}`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Text search failed'));
    }
    return response.json();
  },

  async getSavedRestaurants() {
    const response = await apiFetch('/api/restaurants/saved');
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch saved restaurants'));
    }
    return response.json();
  },

  async saveRestaurant(restaurantData) {
    const response = await apiFetch('/api/restaurants/save', {
      method: 'POST',
      body: restaurantData,
    });
    if (!response.ok) {
      const err = await errorFrom(response, 'Failed to save restaurant');
      // If already saved, we treat as successful idempotency
      if (err && err.includes('already')) {
        return { message: 'Already saved' };
      }
      throw new Error(err);
    }
    return response.json();
  },

  async unsaveRestaurant(restaurantId) {
    const response = await apiFetch(`/api/restaurants/saved/${restaurantId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to remove saved restaurant'));
    }
    return response.json();
  },

  async getDetails(placeId) {
    const response = await apiFetch(`/api/restaurants/details/${placeId}`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to load restaurant details'));
    }
    return response.json();
  },
};
