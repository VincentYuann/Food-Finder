import { apiClient } from './client';

export const authApi = {
  async getProfile() {
    const { data } = await apiClient.get('/api/users/profile');
    return data;
  },

  async login({ identifier, password }) {
    const isEmail = identifier.includes('@');
    const { data } = await apiClient.post('/api/users/login', {
      email: isEmail ? identifier : undefined,
      username: isEmail ? undefined : identifier,
      password,
    });
    return data;
  },

  async register({ username, email, password }) {
    const { data } = await apiClient.post('/api/users/register', {
      username,
      email,
      password,
    });
    return data;
  },

  async logout() {
    try {
      await apiClient.post('/api/users/logout');
    } catch {
      // Ignore errors if already logged out or expired
    }
    return true;
  },

  async getUserLobbies() {
    const { data } = await apiClient.get('/api/users/profile/lobbies');
    return data;
  },
};

