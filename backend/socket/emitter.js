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

/**
 * Pushes the lobby record itself — name, status, chosen restaurant, members.
 *
 * Status is the field that gates every other bit of the page: whether the vote
 * buttons exist, what the ready button says, whether the winner banner shows.
 * Without this event a member who wasn't the one clicking "Start Voting" sat on
 * a stale `status` until they reloaded, which is why their ready button and
 * vote cards never appeared.
 */
export const emitLobbyState = (lobbyId, lobby) => {
    if (!io) return;
    io.to(lobbyRoom(lobbyId)).emit('lobby:state', lobby);
};

/** Pushes the full shortlist after anyone adds or removes an option. */
export const emitLobbyOptions = (lobbyId, options) => {
    if (!io) return;
    io.to(lobbyRoom(lobbyId)).emit('lobby:options', options);
};

/** Pushes every vote in the lobby so tallies move as people click. */
export const emitLobbyVotes = (lobbyId, votes) => {
    if (!io) return;
    io.to(lobbyRoom(lobbyId)).emit('lobby:votes', votes);
};
