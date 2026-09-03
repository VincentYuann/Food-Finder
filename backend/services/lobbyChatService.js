import prisma from '../config/dbConfig.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { emitLobbyMessage } from '../socket/emitter.js';
import myCache from '../utils/cache.js';

// Postgres `text` has no limit of its own, so the cap lives here. Without it a
// single client could push an unbounded blob to every other member of a lobby.
export const MAX_MESSAGE_LENGTH = 2000;

/** Bad input from the caller, as opposed to a database failure. */
export class MessageValidationError extends Error {}

/**
 * Persists a chat message and pushes it to the lobby room.
 *
 * Both the REST endpoint and the Socket.IO handler go through here, so a
 * message sent either way is stored identically and reaches connected members
 * the same way. The returned record includes the author, matching the shape
 * GET /api/lobbies/:id/messages returns.
 */
export const createLobbyMessage = async ({ lobbyId, userId, content, imageUrl }) => {
    const text = typeof content === 'string' ? content.trim() : '';
    const image = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;

    if (!text && !image) {
        throw new MessageValidationError('A message needs content or an image.');
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
        throw new MessageValidationError(
            `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
        );
    }

    const message = await prisma.message.create({
        data: {
            lobby_id: lobbyId,
            user_id: userId,
            content: text || null,
            image_url: image,
        },
        include: { user: { select: publicUserSelect } }
    });

    myCache.del(`lobby_messages_${lobbyId}`);
    emitLobbyMessage(lobbyId, message);

    return message;
};
