import prisma from '../config/dbConfig.js';

/**
 * Requires the authenticated user to be a member of the lobby in :id.
 * Must run after verifyJWT.
 *
 * On success, attaches:
 *   req.lobbyId - the parsed lobby id
 *   req.lobby   - the lobby record (so handlers don't refetch it)
 */
export const isLobbyMember = async (req, res, next) => {
    const lobbyId = parseInt(req.params.id, 10);

    if (Number.isNaN(lobbyId)) {
        return res.status(400).json({ error: 'Invalid lobby id.' });
    }

    try {
        const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });

        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found.' });
        }

        const membership = await prisma.lobbyMember.findUnique({
            where: {
                lobby_id_user_id: { lobby_id: lobbyId, user_id: req.user.id }
            }
        });

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this lobby.' });
        }

        req.lobbyId = lobbyId;
        req.lobby = lobby;
        next();
    } catch (error) {
        console.error('isLobbyMember error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export default isLobbyMember;
