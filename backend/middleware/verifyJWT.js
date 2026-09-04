import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwtConfig.js';

export const verifyJWT = (req, res, next) => {
    let token = req.cookies?.token;

    // Support Bearer token in Authorization header for cross-domain / third-party cookie blocked environments (Safari ITP, Incognito)
    if (!token && req.headers?.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            token = parts[1];
        }
    }

    // If user doesn't send a token with them or if the token is modified by malicious user, then deny their access
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided!' });
    }

    try {
        const decodedUser = jwt.verify(token, JWT_SECRET);

        // Attach decoded payload to request object (in this case, it's { id: user.id }).
        // Normalize id to a Number so downstream handlers can use req.user.id directly.
        req.user = { ...decodedUser, id: Number(decodedUser.id) };

        if (Number.isNaN(req.user.id)) {
            return res.status(403).json({ message: 'Invalid or Expired Token!' });
        }

        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or Expired Token!' });
    }
};

export default verifyJWT;