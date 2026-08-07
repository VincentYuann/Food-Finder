import prisma from '../config/dbConfig.js';

/**
 * Requires the authenticated user to be the creator of the lobby in :id.
 * Must run after verifyJWT. Reuses req.lobby if isLobbyMember already loaded it.
 *
 * On success, attaches:
 *   req.lobbyId - the parsed lobby id
 *   req.lobby   - the lobby record
 */
export const isLobbyCreator = async (req, res, next) => {
    const lobbyId = parseInt(req.params.id, 10);

    if (Number.isNaN(lobbyId)) {
        return res.status(400).json({ error: 'Invalid lobby id.' });
    }

    try {
        const lobby = req.lobby ?? await prisma.lobby.findUnique({ where: { id: lobbyId } });

        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found.' });
        }

        if (lobby.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Only the lobby creator can do that.' });
        }

        req.lobbyId = lobbyId;
        req.lobby = lobby;
        next();
    } catch (error) {
        console.error('isLobbyCreator error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export default isLobbyCreator;
