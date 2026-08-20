// Holds the live Socket.IO server so any layer can push to a lobby without
// importing the connection handling (which would import the services back,
// and ESM circular imports are a debugging tax nobody needs).

let io = null;

export const setIo = (instance) => {
    io = instance;
};

/** Every member of one lobby shares a room; broadcasts are scoped to it. */
export const lobbyRoom = (lobbyId) => `lobby:${lobbyId}`;

/**
 * Pushes a newly created message to everyone currently sitting in the lobby.
 * A no-op until initSocket() has run — under `jest` there is no HTTP server,
 * and saving a message should never fail just because nobody is listening.
 */
export const emitLobbyMessage = (lobbyId, message) => {
    if (!io) return;
    io.to(lobbyRoom(lobbyId)).emit('chat:message', message);
};

/**
 * Pushes the full member list to everyone in the lobby.
 *
 * A snapshot rather than a delta: the list is short, and re-sending all of it
 * means a client that missed an event while reconnecting still ends up correct
 * without having to replay anything.
 */
export const emitLobbyMembers = (lobbyId, members) => {
    if (!io) return;
    io.to(lobbyRoom(lobbyId)).emit('lobby:members', members);
};
