import axios from 'axios';

export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
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
 * Axios-backed apiFetch helper for backward compatibility and uniform API calls.
 */
export async function apiFetch(path, { method = 'GET', body, headers, params, ...rest } = {}) {
  const config = {
    url: path,
    method: method.toLowerCase(),
    headers,
    params,
    ...rest,
  };

  if (body !== undefined) {
    config.data = body;
  }

  const response = await apiClient(config);

  // Return fetch-like response interface so existing consumers stay compatible
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data: response.data,
    json: async () => response.data,
  };
}

/**
 * Extracts error message from response or Error object.
 */
export async function errorFrom(error, fallback = 'Something went wrong') {
  if (error instanceof Error) return error.message;
  if (error?.response?.data) {
    return error.response.data.error || error.response.data.message || fallback;
  }
  return fallback;
}

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

