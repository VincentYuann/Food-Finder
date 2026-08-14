import 'dotenv/config';

// One source of truth for the signing secret. The REST middleware and the
// Socket.IO handshake both verify tokens, and they must never drift apart —
// a mismatch would let a user in on one and reject them on the other.
export const JWT_SECRET =
    process.env.JWT_SECRET || 'TEmporarYYY_secret_key_here=2818391023809129300$*()!*)(#KJDSKLJDALSKJ';

export default JWT_SECRET;
