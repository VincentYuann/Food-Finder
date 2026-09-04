import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import prisma from '../config/dbConfig.js';
import { JWT_SECRET } from '../config/jwtConfig.js';
import getCorsOrigin from '../config/corsConfig.js';
import { setIo, lobbyRoom } from './emitter.js';
import { createLobbyMessage, MessageValidationError } from '../services/lobbyChatService.js';

/**
 * Socket.IO handshakes carry the same HttpOnly JWT cookie the REST API uses —
 * the browser attaches it automatically because the client connects with
 * `withCredentials`. Nothing here reads a token from the client payload: a
 * token the page could hand us is a token an attacker could hand us too.
 */
const authenticate = (socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const authToken = socket.handshake.auth?.ticket || socket.handshake.auth?.token;
    const headerAuth = socket.handshake.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null;

    const token = authToken || headerAuth || cookies.token;

    if (!token) {
        return next(new Error('Access Denied: No Token Provided!'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const id = Number(decoded.id);

        if (Number.isNaN(id)) {
            return next(new Error('Invalid or Expired Token!'));
        }

        socket.data.user = { ...decoded, id };
        next();
    } catch {
        next(new Error('Invalid or Expired Token!'));
    }
};

/**
 * Membership is re-checked on every join and every send rather than trusted
 * from the handshake — a socket can outlive being kicked from a lobby.
 */
const isMemberOf = async (lobbyId, userId) => {
    const membership = await prisma.lobbyMember.findUnique({
        where: { lobby_id_user_id: { lobby_id: lobbyId, user_id: userId } }
    });

    return Boolean(membership);
};

/** Acks are optional on the wire, so never assume the client sent a callback. */
const respond = (ack, payload) => {
    if (typeof ack === 'function') ack(payload);
};

const parseLobbyId = (value) => {
    const lobbyId = parseInt(value, 10);
    return Number.isNaN(lobbyId) ? null : lobbyId;
};

const handleJoin = async (socket, rawLobbyId, ack) => {
    const lobbyId = parseLobbyId(rawLobbyId);

    if (lobbyId === null) {
        return respond(ack, { ok: false, error: 'Invalid lobby id.' });
    }

    try {
        if (!(await isMemberOf(lobbyId, socket.data.user.id))) {
            return respond(ack, { ok: false, error: 'You are not a member of this lobby.' });
        }

        socket.join(lobbyRoom(lobbyId));
        respond(ack, { ok: true, lobbyId });
    } catch (error) {
        console.error('socket lobby:join error:', error);
        respond(ack, { ok: false, error: 'Internal server error.' });
    }
};

const handleLeave = (socket, rawLobbyId, ack) => {
    const lobbyId = parseLobbyId(rawLobbyId);

    if (lobbyId === null) {
        return respond(ack, { ok: false, error: 'Invalid lobby id.' });
    }

    socket.leave(lobbyRoom(lobbyId));
    respond(ack, { ok: true });
};

const handleSend = async (socket, payload, ack) => {
    const lobbyId = parseLobbyId(payload?.lobbyId);

    if (lobbyId === null) {
        return respond(ack, { ok: false, error: 'Invalid lobby id.' });
    }

    try {
        if (!(await isMemberOf(lobbyId, socket.data.user.id))) {
            socket.leave(lobbyRoom(lobbyId));
            return respond(ack, { ok: false, error: 'You are not a member of this lobby.' });
        }

        // createLobbyMessage broadcasts to the room, and the sender is in that
        // room too — so the ack confirms delivery rather than carrying the
        // message back a second time.
        const message = await createLobbyMessage({
            lobbyId,
            userId: socket.data.user.id,
            content: payload?.content,
            imageUrl: payload?.imageUrl,
        });

        respond(ack, { ok: true, messageId: message.id });
    } catch (error) {
        if (error instanceof MessageValidationError) {
            return respond(ack, { ok: false, error: error.message });
        }
        console.error('socket chat:send error:', error);
        respond(ack, { ok: false, error: 'Could not send your message.' });
    }
};

/**
 * Attaches the chat server to the existing HTTP server, so WebSocket traffic
 * and the REST API share one port.
 */
export const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: getCorsOrigin(),
            credentials: true // the handshake has to carry the JWT cookie
        }
    });

    io.use(authenticate);

    io.on('connection', (socket) => {
        socket.on('lobby:join', (lobbyId, ack) => handleJoin(socket, lobbyId, ack));
        socket.on('lobby:leave', (lobbyId, ack) => handleLeave(socket, lobbyId, ack));
        socket.on('chat:send', (payload, ack) => handleSend(socket, payload, ack));
    });

    setIo(io);

    return io;
};

export default initSocket;
