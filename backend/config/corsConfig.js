import 'dotenv/config';

/**
 * The single browser origin allowed to call this API with credentials.
 * Shared by the Express CORS middleware and the Socket.IO handshake so the
 * WebSocket can't accidentally be more permissive than the REST API.
 */
export const getCorsOrigin = () => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.FRONTEND_URL; // e.g., 'https://my-live-website.com'
    }
    return 'http://localhost:3000';
};

export default getCorsOrigin;
