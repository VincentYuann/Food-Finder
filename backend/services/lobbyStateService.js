import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { emitLobbyState } from '../socket/emitter.js';

/**
 * The lobby as the page needs it: header fields, the creator, the winning
 * restaurant once one exists, and the member list.
 *
 * Both GET /api/lobbies/:id and the lobby:state broadcast go through here, so
 * the object a client gets on load is identical to the one it gets pushed and
 * the same render handles both.
 */
export const getLobbyState = (lobbyId) =>
    prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
            creator: { select: publicUserSelect },
            chosen_restaurant: true,
            members: {
                orderBy: { joined_at: 'asc' },
                include: { user: { select: publicUserSelect } }
            },
        }
    });

/**
 * Re-reads the lobby and pushes it to everyone sitting in it.
 *
 * Also drops the cached copies this invalidates — the lobby's own entry plus
 * every member's dashboard list, which shows the status too. Doing it here
 * rather than at each call site means a write path can't broadcast a fresh
 * status while the REST endpoint keeps serving the old one for an hour.
 *
 * Failures are logged and swallowed: the write that triggered this already
 * committed, and it shouldn't fail just because nobody was listening.
 */
export const broadcastLobbyState = async (lobbyId) => {
    try {
        myCache.del(`lobby_${lobbyId}`);

        const lobby = await getLobbyState(lobbyId);
        if (!lobby) return;

        lobby.members.forEach((member) => myCache.del(`user_lobbies_${member.user_id}`));
        emitLobbyState(lobbyId, lobby);
    } catch (error) {
        console.error('Failed to broadcast lobby state:', error);
    }
};
