import { apiFetch, errorFrom } from './client';

export const lobbyApi = {
  async createLobby(name) {
    const response = await apiFetch('/api/lobbies', {
      method: 'POST',
      body: { name },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Could not create the lobby'));
    }
    return response.json();
  },

  async joinLobby(invite_code) {
    const response = await apiFetch('/api/lobbies/join', {
      method: 'POST',
      body: { invite_code },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Could not join the lobby'));
    }
    return response.json();
  },

  async getLobby(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch lobby details'));
    }
    return response.json();
  },

  async updateLobbyStatus(lobbyId, status) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}`, {
      method: 'PATCH',
      body: { status },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to update lobby status'));
    }
    return response.json();
  },

  async deleteLobby(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to delete lobby'));
    }
    return response.json();
  },

  async leaveLobby(lobbyId, userId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/members/${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to leave lobby'));
    }
    return response.json();
  },

  async getMembers(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/members`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch members'));
    }
    return response.json();
  },

  async setReady(lobbyId, ready) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/members/ready`, {
      method: 'PATCH',
      body: { ready },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to update ready state'));
    }
    return response.json();
  },

  async getRestaurants(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/restaurants`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch lobby restaurants'));
    }
    return response.json();
  },

  async addRestaurant(lobbyId, api_place_id) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/restaurants`, {
      method: 'POST',
      body: { api_place_id },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to add restaurant to lobby'));
    }
    return response.json();
  },

  async removeRestaurant(lobbyId, restaurantId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/restaurants/${restaurantId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to remove restaurant from lobby'));
    }
    return response.json();
  },

  async getVotes(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/votes`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch votes'));
    }
    return response.json();
  },

  async castVote(lobbyId, restaurantId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/votes`, {
      method: 'POST',
      body: { restaurantId },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to cast vote'));
    }
    return response.json();
  },

  async getMessages(lobbyId) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/messages`);
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch messages'));
    }
    return response.json();
  },

  async sendMessage(lobbyId, content) {
    const response = await apiFetch(`/api/lobbies/${lobbyId}/messages`, {
      method: 'POST',
      body: { content },
    });
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to send message'));
    }
    return response.json();
  },
};
