import prisma from '../config/dbConfig.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { emitLobbyMembers } from '../socket/emitter.js';

/**
 * The member list of one lobby, oldest join first.
 *
 * Every path that returns or broadcasts members goes through here, so the
 * shape a client gets over the socket is identical to the one
 * GET /api/lobbies/:id/members returns and the same renderer handles both.
 */
export const listLobbyMembers = (lobbyId) =>
    prisma.lobbyMember.findMany({
        where: { lobby_id: lobbyId },
        orderBy: { joined_at: 'asc' },
        include: { user: { select: publicUserSelect } }
    });

/**
 * Re-reads the member list and pushes it to everyone sitting in the lobby.
 *
 * Called after anything that changes membership or ready state. The read
 * happens after the write has committed, so the snapshot that goes out is
 * never the pre-change one.
 *
 * Failures are logged and swallowed: a member who joined or readied up did so
 * successfully even if the other tabs have to wait for their next refresh to
 * find out.
 */
export const broadcastLobbyMembers = async (lobbyId) => {
    try {
        emitLobbyMembers(lobbyId, await listLobbyMembers(lobbyId));
    } catch (error) {
        console.error('Failed to broadcast lobby members:', error);
    }
};
