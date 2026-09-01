export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://food-finder-backend-270543644290.northamerica-northeast1.run.app');

/**
 * Enhanced fetch wrapper with credentials attached for HttpOnly cookie authentication.
 */
export async function apiFetch(path, { method = 'GET', body, headers, ...rest } = {}) {
  const options = {
    method,
    credentials: 'include',
    ...rest,
  };

  const finalHeaders = { ...headers };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  options.headers = finalHeaders;

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, options);

  return response;
}

/**
 * Extracts error message from API response with a safe fallback.
 */
export async function errorFrom(response, fallback = 'Something went wrong') {
  try {
    const data = await response.json();
    return data.error || data.message || fallback;
  } catch {
    return fallback;
  }
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
