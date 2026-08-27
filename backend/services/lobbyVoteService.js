import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { emitLobbyVotes } from '../socket/emitter.js';

/**
 * Every vote cast in one lobby. The client tallies these per restaurant rather
 * than being handed counts, because it also needs to know which option the
 * current user picked in order to light up their own card.
 */
export const listLobbyVotes = (lobbyId) =>
    prisma.vote.findMany({
        where: { lobby_id: lobbyId },
        include: {
            user: { select: publicUserSelect },
            restaurant: true
        }
    });

/** Re-reads the votes and pushes them, so tallies move as people click. */
export const broadcastLobbyVotes = async (lobbyId) => {
    try {
        myCache.del(`lobby_votes_${lobbyId}`);
        emitLobbyVotes(lobbyId, await listLobbyVotes(lobbyId));
    } catch (error) {
        console.error('Failed to broadcast lobby votes:', error);
    }
};
