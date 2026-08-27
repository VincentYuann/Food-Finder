import { getRestaurantDetails } from '../services/googlePlacesService.js';
import { randomInt } from 'crypto';
import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import { cachePhotoToS3 } from '../services/s3Service.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { createLobbyMessage, MessageValidationError } from '../services/lobbyChatService.js';
import { listLobbyMembers, broadcastLobbyMembers } from '../services/lobbyMemberService.js';
import { getLobbyState, broadcastLobbyState } from '../services/lobbyStateService.js';
import { listLobbyOptions, broadcastLobbyOptions } from '../services/lobbyOptionService.js';
import { listLobbyVotes, broadcastLobbyVotes } from '../services/lobbyVoteService.js';

// Ambiguous characters (I, O, 0, 1) are left out so codes are easy to read aloud.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

const generateInviteCode = () => {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    }
    return code;
};

// ==========================================
// LOBBIES
// ==========================================

/**
 * GET /api/lobbies
 * Lobbies the authenticated user belongs to. Scoped to the user on purpose —
 * listing every lobby on the server would leak other people's plans.
 */
export const getMyLobbies = async (req, res) => {
    try {
        const cacheKey = `user_lobbies_${req.user.id}`;
        if (myCache.has(cacheKey)) {
            return res.status(200).json(myCache.get(cacheKey));
        }

        const memberships = await prisma.lobbyMember.findMany({
            where: { user_id: req.user.id },
            orderBy: { joined_at: 'desc' },
            include: {
                lobby: {
                    include: {
                        creator: { select: publicUserSelect },
                        chosen_restaurant: true,
                        _count: { select: { members: true } },
                    }
                }
            }
        });

        const result = memberships.map((m) => m.lobby);
        myCache.set(cacheKey, result);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching lobbies:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * POST /api/lobbies
 * Creates a lobby and adds the creator as its first member.
 */
export const createLobby = async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
        return res.status(400).json({ error: 'Lobby name is required.' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'Lobby name must be 100 characters or fewer.' });
    }

    // Invite codes are random, so a collision is possible. Retry a few times
    // before giving up rather than handing back a 500 on a 1-in-a-million clash.
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const lobby = await prisma.$transaction(async (tx) => {
                const created = await tx.lobby.create({
                    data: {
                        name,
                        created_by: req.user.id,
                        invite_code: generateInviteCode(),
                        status: 'active',
                    }
                });

                await tx.lobbyMember.create({
                    data: { lobby_id: created.id, user_id: req.user.id }
                });

                return created;
            });

            myCache.del(`user_lobbies_${req.user.id}`);
            return res.status(201).json(lobby);
        } catch (error) {
            // P2002 = unique constraint violation; only retry when it was the invite code.
            if (error.code === 'P2002' && error.meta?.target?.includes('invite_code')) {
                continue;
            }
            console.error('Error creating lobby:', error);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    }

    res.status(500).json({ error: 'Could not generate a unique invite code. Please try again.' });
};

/**
 * POST /api/lobbies/join
 * Body: { invite_code }
 * Joins the authenticated user to a lobby by its invite code.
 */
export const joinLobbyByCode = async (req, res) => {
    const rawCode = typeof req.body.invite_code === 'string' ? req.body.invite_code : '';
    const inviteCode = rawCode.trim().toUpperCase();

    if (!inviteCode) {
        return res.status(400).json({ error: 'An invite code is required.' });
    }

    try {
        const lobby = await prisma.lobby.findUnique({ where: { invite_code: inviteCode } });

        if (!lobby) {
            return res.status(404).json({ error: 'No lobby found with that invite code.' });
        }
        if (lobby.status === 'closed') {
            return res.status(409).json({ error: 'That lobby is already closed.' });
        }

        // Idempotent: re-joining a lobby you're already in just returns it.
        await prisma.lobbyMember.upsert({
            where: {
                lobby_id_user_id: { lobby_id: lobby.id, user_id: req.user.id }
            },
            update: {},
            create: { lobby_id: lobby.id, user_id: req.user.id },
        });

        // Members already sitting in the lobby see the newcomer appear.
        await broadcastLobbyMembers(lobby.id);

        myCache.del(`user_lobbies_${req.user.id}`);
        myCache.del(`lobby_members_${lobby.id}`);
        myCache.del(`lobby_${lobby.id}`);
        res.status(200).json(lobby);
    } catch (error) {
        console.error('Error joining lobby:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * GET /api/lobbies/:id
 * Members only. Restaurant options, votes and messages have their own endpoints.
 */
export const getLobby = async (req, res) => {
    try {
        const cacheKey = `lobby_${req.lobbyId}`;
        if (myCache.has(cacheKey)) return res.status(200).json(myCache.get(cacheKey));

        const lobby = await getLobbyState(req.lobbyId);

        myCache.set(cacheKey, lobby);
        res.status(200).json(lobby);
    } catch (error) {
        console.error('Error fetching lobby:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * PATCH /api/lobbies/:id
 * Creator only. Fields are whitelisted so callers can't set arbitrary columns.
 */
export const updateLobby = async (req, res) => {
    const { name, status } = req.body;
    const allowedStatuses = ['active', 'voting', 'eating', 'closed'];
    const data = {};

    if (name !== undefined) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (!trimmed) {
            return res.status(400).json({ error: 'Lobby name cannot be empty.' });
        }
        if (trimmed.length > 100) {
            return res.status(400).json({ error: 'Lobby name must be 100 characters or fewer.' });
        }
        data.name = trimmed;
    }

    if (status !== undefined) {
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}.` });
        }
        // ensure every other member is ready if creator is trying to close
        if (status === 'closed') {
            try {
                const totalMembers = await prisma.lobbyMember.count({ where: { lobby_id: req.lobbyId } });
                const readyCount = await prisma.lobbyMember.count({
                    where: { lobby_id: req.lobbyId, ready: true }
                });
                if (totalMembers > 1 && readyCount < (totalMembers - 1)) {
                    return res.status(400).json({ error: 'Cannot close lobby: not all other members are ready.' });
                }
            } catch (err) {
                console.error('Error validating ready counts:', err);
                return res.status(500).json({ error: 'Internal server error.' });
            }
        }
        data.status = status;
        data.closed_at = status === 'closed' ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
    }

    try {
        const updated = await prisma.lobby.update({ where: { id: req.lobbyId }, data });

        // Moving into the voting phase clears the ready flags, the same way the
        // automatic transition in setMemberReady does. Without this the ticks
        // people set to say "I'm ready to vote" would carry straight over into
        // "ready to close", and the host could close the lobby before a single
        // vote had been cast.
        if (data.status === 'voting' && req.lobby.status !== 'voting') {
            await prisma.lobbyMember.updateMany({
                where: { lobby_id: req.lobbyId },
                data: { ready: false }
            });
        }

        myCache.del(`lobby_${req.lobbyId}`);
        myCache.del(`user_lobbies_${req.user.id}`);
        myCache.del(`lobby_members_${req.lobbyId}`);

        // A phase change reveals the vote UI (entering 'voting') or the winner
        // banner (entering 'closed'), and both render off the tally — so send
        // the votes along rather than making every client refetch them.
        if (data.status !== undefined) {
            await broadcastLobbyVotes(req.lobbyId);
        }

        // The phase gates the whole page — vote buttons, the ready button's
        // label, the winner banner. Everyone else finds out now instead of on
        // their next refresh. State before members: the member render reads the
        // phase to decide what the ready button should say.
        await broadcastLobbyState(req.lobbyId);
        await broadcastLobbyMembers(req.lobbyId);

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error updating lobby:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * DELETE /api/lobbies/:id
 * Creator only. Members, options, votes and messages cascade via the schema.
 */
export const deleteLobby = async (req, res) => {
    try {
        await prisma.lobby.delete({ where: { id: req.lobbyId } });
        myCache.del(`lobby_${req.lobbyId}`);
        myCache.del(`user_lobbies_${req.user.id}`);
        // Actually, deleting a lobby affects all members, but we can just invalidate the creator's lobbies for now
        // since they're the only one who can delete it. Or we could flushall if we were lazy.
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting lobby:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// LOBBY MEMBERS
// ==========================================

/**
 * GET /api/lobbies/:id/members
 */
export const getLobbyMembers = async (req, res) => {
    try {
        const cacheKey = `lobby_members_${req.lobbyId}`;
        if (myCache.has(cacheKey)) return res.status(200).json(myCache.get(cacheKey));

        const members = await listLobbyMembers(req.lobbyId);
        myCache.set(cacheKey, members);
        res.status(200).json(members);
    } catch (error) {
        console.error('Error fetching lobby members:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * DELETE /api/lobbies/:id/members/:userId
 * A member can remove themselves; the creator can remove anyone else.
 * The creator cannot leave their own lobby — they delete it instead.
 */
export const removeLobbyMember = async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);

    if (Number.isNaN(targetUserId)) {
        return res.status(400).json({ error: 'Invalid user id.' });
    }

    const isSelf = targetUserId === req.user.id;
    const isCreator = req.lobby.created_by === req.user.id;

    if (!isSelf && !isCreator) {
        return res.status(403).json({ error: 'You can only remove yourself from this lobby.' });
    }
    if (targetUserId === req.lobby.created_by) {
        return res.status(400).json({
            error: 'The lobby creator cannot leave. Delete the lobby instead.'
        });
    }

    try {
        await prisma.lobbyMember.delete({
            where: {
                lobby_id_user_id: { lobby_id: req.lobbyId, user_id: targetUserId }
            }
        });

        myCache.del(`lobby_members_${req.lobbyId}`);
        myCache.del(`lobby_${req.lobbyId}`);
        myCache.del(`user_lobbies_${targetUserId}`);

        await broadcastLobbyMembers(req.lobbyId);
        res.status(204).send();
    } catch (error) {
        // P2025 = record to delete does not exist
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'That user is not a member of this lobby.' });
        }
        console.error('Error removing lobby member:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * PATCH /api/lobbies/:id/members/ready
 * Body: { ready: boolean }
 * Sets the current authenticated user's ready flag in this lobby.
 */
export const setMemberReady = async (req, res) => {
    const requestedReady = !!req.body.ready; // coerce to boolean

    try {
        const updated = await prisma.lobbyMember.update({
            where: {
                lobby_id_user_id: { lobby_id: req.lobbyId, user_id: req.user.id }
            },
            data: { ready: requestedReady },
            include: { user: { select: publicUserSelect } }
        });

        // check if everyone is ready
        let phaseChanged = false;
        if ((req.lobby.status === 'active' || req.lobby.status === 'voting') && requestedReady) {
            const totalMembers = await prisma.lobbyMember.count({ where: { lobby_id: req.lobbyId } });
            const readyCount = await prisma.lobbyMember.count({ where: { lobby_id: req.lobbyId, ready: true } });
            
            if (totalMembers > 0 && readyCount === totalMembers) {
                const nextStatus = req.lobby.status === 'active' ? 'voting' : 'closed';
                // Auto transition to next status
                await prisma.lobby.update({
                    where: { id: req.lobbyId },
                    data: { 
                        status: nextStatus,
                        ...(nextStatus === 'closed' ? { closed_at: new Date() } : {})
                    }
                });
                
                if (nextStatus === 'voting') {
                    // reset everyone's ready status for the voting phase
                    await prisma.lobbyMember.updateMany({
                        where: { lobby_id: req.lobbyId },
                        data: { ready: false }
                    });
                }
                phaseChanged = true;
            }
        }

        myCache.del(`lobby_members_${req.lobbyId}`);
        myCache.del(`lobby_${req.lobbyId}`);

        // The last person to ready up flips the whole lobby into voting. That
        // has to go out before the member list, so every tab has the new phase
        // by the time it re-renders the (now cleared) ready badges.
        if (phaseChanged) {
            await broadcastLobbyVotes(req.lobbyId);
            await broadcastLobbyState(req.lobbyId);
        }

        // Everyone's ready tally — and the host's Close Lobby button — updates
        // without waiting for a refresh.
        await broadcastLobbyMembers(req.lobbyId);
        res.status(200).json(updated);
    } catch (error) {
        // P2025 = record to update does not exist
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Membership not found.' });
        }
        console.error('Error setting ready state:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// LOBBY RESTAURANT OPTIONS
// ==========================================

export const getLobbyRestaurants = async (req, res) => {
    try {
        const cacheKey = `lobby_restaurants_${req.lobbyId}`;
        if (myCache.has(cacheKey)) return res.status(200).json(myCache.get(cacheKey));

        // listLobbyOptions also re-pulls any restaurant the cache purge emptied.
        const options = await listLobbyOptions(req.lobbyId);

        myCache.set(cacheKey, options);
        res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching lobby restaurants:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const addLobbyRestaurant = async (req, res) => {
    if (req.lobby.status !== 'active') {
        return res.status(403).json({ error: 'Restaurant options cannot be added once voting has started.' });
    }

    let restaurantId = parseInt(req.body.restaurantId, 10);
    const { api_place_id } = req.body;

    // Validate that at least one identifier is provided
    if (Number.isNaN(restaurantId) && !api_place_id) {
        return res.status(400).json({ error: 'A valid restaurantId or api_place_id is required.' });
    }

    try {
        // If coming from search (api_place_id), resolve or create the restaurant in the DB
        if (Number.isNaN(restaurantId) && api_place_id) {
            let restaurant = await prisma.restaurant.findUnique({
                where: { api_place_id }
            });

            // If it hasn't been cached yet, fetch details from Google Places and save it
            if (!restaurant) {
                const details = await getRestaurantDetails(api_place_id);
                restaurant = await prisma.restaurant.create({
                    data: {
                        api_place_id: details.api_place_id,
                        name: details.name,
                        address: details.address,
                        latitude: details.latitude,
                        longitude: details.longitude,
                        rating: details.rating,
                        price_level: details.price_level,
                        photo_url: details.photo_url
                    }
                });
            }
            restaurantId = restaurant.id;
        }

        // Add the restaurant to the lobby options
        const option = await prisma.lobbyRestaurantOption.create({
            data: {
                lobby_id: req.lobbyId,
                restaurant_id: restaurantId,
                added_by: req.user.id,
            },
            include: {
                restaurant: true,
                adder: { select: publicUserSelect }
            }
        });

        // Everyone else sees the new card appear in their shortlist.
        await broadcastLobbyOptions(req.lobbyId);

        res.status(201).json(option);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'That restaurant is already an option in this lobby.' });
        }
        if (error.code === 'P2003') {
            return res.status(404).json({ error: 'That restaurant could not be found in the database.' });
        }
        console.error('Error adding lobby restaurant:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// VOTES
// ==========================================

export const getLobbyVotes = async (req, res) => {
    try {
        const cacheKey = `lobby_votes_${req.lobbyId}`;
        if (myCache.has(cacheKey)) return res.status(200).json(myCache.get(cacheKey));

        const votes = await listLobbyVotes(req.lobbyId);

        myCache.set(cacheKey, votes);
        res.status(200).json(votes);
    } catch (error) {
        console.error('Error fetching lobby votes:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const castVote = async (req, res) => {
    if (req.lobby.status !== 'voting') {
        return res.status(403).json({ error: 'Voting is not currently active.' });
    }

    const restaurantId = parseInt(req.body.restaurantId, 10);

    if (Number.isNaN(restaurantId)) {
        return res.status(400).json({ error: 'A valid restaurantId is required.' });
    }

    try {
        const totalMembers = await prisma.lobbyMember.count({ where: { lobby_id: req.lobbyId } });
        const totalVotes = await prisma.vote.count({ where: { lobby_id: req.lobbyId } });
        // If the current user hasn't voted yet, they are allowed to vote up until everyone has voted.
        // If they already voted, they can only change if not everyone has voted yet.
        const existingVote = await prisma.vote.findUnique({
            where: { lobby_id_user_id: { lobby_id: req.lobbyId, user_id: req.user.id } }
        });

        if (totalVotes >= totalMembers && existingVote) {
            return res.status(403).json({ error: 'Everyone has voted. No more changes can be made.' });
        }
        
        // Only options that were actually shortlisted in this lobby are votable.
        const option = await prisma.lobbyRestaurantOption.findUnique({
            where: {
                lobby_id_restaurant_id: { lobby_id: req.lobbyId, restaurant_id: restaurantId }
            }
        });

        if (!option) {
            return res.status(400).json({ error: 'That restaurant is not an option in this lobby.' });
        }

        // One vote per person per lobby: re-voting replaces the previous choice.
        const vote = await prisma.vote.upsert({
            where: {
                lobby_id_user_id: { lobby_id: req.lobbyId, user_id: req.user.id }
            },
            update: { restaurant_id: restaurantId },
            create: {
                lobby_id: req.lobbyId,
                user_id: req.user.id,
                restaurant_id: restaurantId,
            }
        });

        // Tallies move on every other member's screen as the click lands.
        await broadcastLobbyVotes(req.lobbyId);

        res.status(201).json(vote);
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// ==========================================
// MESSAGES (lobby chat)
// ==========================================

export const getLobbyMessages = async (req, res) => {
    try {
        const cacheKey = `lobby_messages_${req.lobbyId}`;
        if (myCache.has(cacheKey)) return res.status(200).json(myCache.get(cacheKey));

        const messages = await prisma.message.findMany({
            where: { lobby_id: req.lobbyId },
            orderBy: { sent_at: 'asc' },
            include: { user: { select: publicUserSelect } }
        });

        myCache.set(cacheKey, messages);
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching lobby messages:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * POST /api/lobbies/:id/messages
 * The fallback path for clients whose WebSocket is down — it goes through the
 * same service as chat:send, so members with a live socket still see the
 * message appear instantly.
 */
export const sendLobbyMessage = async (req, res) => {
    const { content, imageUrl } = req.body;

    try {
        const message = await createLobbyMessage({
            lobbyId: req.lobbyId,
            userId: req.user.id,
            content,
            imageUrl,
        });

        myCache.del(`lobby_messages_${req.lobbyId}`);
        res.status(201).json(message);
    } catch (error) {
        if (error instanceof MessageValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error sending lobby message:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const removeLobbyRestaurant = async (req, res) => {
    if (req.lobby.status !== 'active') {
        return res.status(403).json({ error: 'Restaurant options cannot be removed once voting has started.' });
    }

    const restaurantId = parseInt(req.params.restaurantId, 10);
    if (Number.isNaN(restaurantId)) {
        return res.status(400).json({ error: 'A valid restaurantId is required.' });
    }

    try {
        await prisma.lobbyRestaurantOption.delete({
            where: {
                lobby_id_restaurant_id: { lobby_id: req.lobbyId, restaurant_id: restaurantId }
            }
        });

        await broadcastLobbyOptions(req.lobbyId);

        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            myCache.del(`lobby_restaurants_${req.lobbyId}`);
            return res.status(404).json({ error: 'That restaurant is not in this lobby.' });
        }
        console.error('Error removing lobby restaurant:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
