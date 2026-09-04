import axios from 'axios';

export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : '');

export const SOCKET_BASE_URL = 
  import.meta.env.VITE_SOCKET_BASE_URL || 
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://food-finder-backend-270543644290.northamerica-northeast1.run.app');

/**
 * Pre-configured Axios instance with credentials for HttpOnly cookie authentication.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for uniform, friendly error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

/**
 * Normalizes photo URLs, resolving proxy URLs against API_BASE_URL.
 */
export function getImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

