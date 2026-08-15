// Helpers shared by every page. Loaded before the page's own script, so these
// are plain globals rather than module exports — the pages use classic <script>
// tags, not <script type="module">.

// Change this manually to 'https://api.yourdomain.com' only when deploying to the cloud.
let API_BASE_URL;

if (window.location.hostname === 'localhost') {
    API_BASE_URL = 'http://localhost:5000';
} else {
    API_BASE_URL = 'https://your-backend-api-url.onrender.com';
}

/**
 * fetch() against the API with the session cookie attached.
 *
 * `path` is everything after the host, e.g. '/api/lobbies'. Pass `body` as a
 * plain object and it gets JSON-encoded with the right Content-Type; omit it
 * and no body or Content-Type is sent.
 */
function apiFetch(path, { method = 'GET', body, headers, ...rest } = {}) {
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
async function errorFrom(response, fallback) {
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
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

/**
 * Sends the user to the login page. Uses replace() so the back button doesn't
 * walk them into a page they can no longer load.
 */
function redirectToLogin() {
    window.location.replace('/login.html');
}
