import { apiClient } from './client';

export const lobbyApi = {
  async getMyLobbies() {
    const { data } = await apiClient.get('/api/lobbies');
    return data;
  },

  async createLobby(name) {
    const { data } = await apiClient.post('/api/lobbies', { name });
    return data;
  },

  async joinLobby(invite_code) {
    const { data } = await apiClient.post('/api/lobbies/join', { invite_code });
    return data;
  },

  async getLobby(lobbyId) {
    const { data } = await apiClient.get(`/api/lobbies/${lobbyId}`);
    return data;
  },

  async updateLobbyStatus(lobbyId, status) {
    const { data } = await apiClient.patch(`/api/lobbies/${lobbyId}`, { status });
    return data;
  },

  async deleteLobby(lobbyId) {
    const { data } = await apiClient.delete(`/api/lobbies/${lobbyId}`);
    return data;
  },

  async leaveLobby(lobbyId, userId) {
    const { data } = await apiClient.delete(`/api/lobbies/${lobbyId}/members/${userId}`);
    return data;
  },

  async getMembers(lobbyId) {
    const { data } = await apiClient.get(`/api/lobbies/${lobbyId}/members`);
    return data;
  },

  async setReady(lobbyId, ready) {
    const { data } = await apiClient.patch(`/api/lobbies/${lobbyId}/members/ready`, { ready });
    return data;
  },

  async getRestaurants(lobbyId) {
    const { data } = await apiClient.get(`/api/lobbies/${lobbyId}/restaurants`);
    return data;
  },

  async addRestaurant(lobbyId, api_place_id) {
    const { data } = await apiClient.post(`/api/lobbies/${lobbyId}/restaurants`, { api_place_id });
    return data;
  },

  async removeRestaurant(lobbyId, restaurantId) {
    const { data } = await apiClient.delete(`/api/lobbies/${lobbyId}/restaurants/${restaurantId}`);
    return data;
  },

  async getVotes(lobbyId) {
    const { data } = await apiClient.get(`/api/lobbies/${lobbyId}/votes`);
    return data;
  },

  async castVote(lobbyId, restaurantId) {
    const { data } = await apiClient.post(`/api/lobbies/${lobbyId}/votes`, { restaurantId });
    return data;
  },

  async getMessages(lobbyId) {
    const { data } = await apiClient.get(`/api/lobbies/${lobbyId}/messages`);
    return data;
  },

  async sendMessage(lobbyId, content) {
    const { data } = await apiClient.post(`/api/lobbies/${lobbyId}/messages`, { content });
    return data;
  },
};

