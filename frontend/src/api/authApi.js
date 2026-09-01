import { apiFetch, errorFrom } from './client';

export const authApi = {
  async getProfile() {
    const response = await apiFetch('/api/users/profile');
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Not authenticated'));
    }
    return response.json();
  },

  async login({ identifier, password }) {
    const isEmail = identifier.includes('@');
    const response = await apiFetch('/api/users/login', {
      method: 'POST',
      body: {
        email: isEmail ? identifier : undefined,
        username: isEmail ? undefined : identifier,
        password,
      },
    });

    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Login failed'));
    }
    return response.json();
  },

  async register({ username, email, password }) {
    const response = await apiFetch('/api/users/register', {
      method: 'POST',
      body: { username, email, password },
    });

    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Registration failed'));
    }
    return response.json();
  },

  async logout() {
    const response = await apiFetch('/api/users/logout', { method: 'POST' });
    return response.ok;
  },

  async getUserLobbies() {
    const response = await apiFetch('/api/users/profile/lobbies');
    if (!response.ok) {
      throw new Error(await errorFrom(response, 'Failed to fetch user lobbies'));
    }
    return response.json();
  },
};
