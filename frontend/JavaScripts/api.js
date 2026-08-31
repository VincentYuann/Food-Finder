export const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://food-finder-backend-270543644290.northamerica-northeast1.run.app'; //'https://food-finder-lk9t.onrender.com';

/**
 * fetch() against the API with the session cookie attached.
 *
 * `path` is everything after the host, e.g. '/api/lobbies'. Pass `body` as a
 * plain object and it gets JSON-encoded with the right Content-Type; omit it
 * and no body or Content-Type is sent.
 */
export function apiFetch(path, { method = 'GET', body, headers, ...rest } = {}) {
    const options = {
        method,
        credentials: 'include', // attaches the HttpOnly JWT cookie
        ...rest
    };

    if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json', ...headers };
        options.body = JSON.stringify(body);
    } else if (headers) {
        options.headers = headers;
    }

    return fetch(`${API_BASE_URL}${path}`, options);
}

/**
 * The error message an endpoint returned, falling back to a generic one when
 * the response has no JSON body (a 500 behind a proxy, a dropped connection).
 */
export async function errorFrom(response, fallback) {
    try {
        const body = await response.json();
        return body.error || body.message || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Escapes text before it goes into innerHTML. Lobby names, usernames and
 * restaurant names all come from outside, so none of them can be trusted.
 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

export function redirectToLogin() {
    window.location.replace('/login.html');
}

export function getImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('/api/')) {
        return `${API_BASE_URL}${url}`;
    }
    return url;
}
