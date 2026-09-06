import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { getRestaurantDetails } from './googlePlacesService.js';
import { emitLobbyOptions } from '../socket/emitter.js';

/**
 * The shortlist for one lobby, each option carrying its restaurant and whoever
 * added it.
 *
 * Both GET /api/lobbies/:id/restaurants and the lobby:options broadcast use
 * this, so a card rendered from a push looks the same as one rendered on load.
 */
export const listLobbyOptions = async (lobbyId) => {
    const options = await prisma.lobbyRestaurantOption.findMany({
        where: { lobby_id: lobbyId },
        include: {
            restaurant: true,
            adder: { select: publicUserSelect }
        }
    });

    return Promise.all(options.map(async (option) => {
        // Graceful self-healing only if a legacy unpopulated/purged record exists
        if (!option.restaurant.name && option.restaurant.api_place_id) {
            try {
                const fresh = await getRestaurantDetails(option.restaurant.api_place_id);
                option.restaurant = await prisma.restaurant.update({
                    where: { id: option.restaurant.id },
                    data: {
                        name: fresh.name,
                        address: fresh.address,
                        latitude: fresh.latitude ? parseFloat(fresh.latitude) : null,
                        longitude: fresh.longitude ? parseFloat(fresh.longitude) : null,
                        rating: fresh.rating ? parseFloat(fresh.rating) : null,
                        price_level: fresh.price_level,
                        photo_url: fresh.photo_url,
                        primary_type: fresh.primary_type,
                        user_rating_count: fresh.user_rating_count,
                        phone_number: fresh.phone_number,
                        website_url: fresh.website_url,
                        google_maps_url: fresh.google_maps_url,
                        opening_hours: fresh.opening_hours,
                        cached_at: new Date()
                    }
                });
            } catch (err) {
                console.error('Failed to self-heal lobby option:', option.restaurant.api_place_id, err.message);
            }
        }
        return option;
    }));
};

/**
 * Re-reads the shortlist and pushes it to everyone in the lobby, so a
 * restaurant someone else adds shows up without a refresh.
 *
 * A whole snapshot rather than a delta, matching the member broadcast: the
 * list is short, and re-sending it means a client that missed an event while
 * reconnecting still lands on the right state.
 */
export const broadcastLobbyOptions = async (lobbyId) => {
    try {
        myCache.del(`lobby_restaurants_${lobbyId}`);
        emitLobbyOptions(lobbyId, await listLobbyOptions(lobbyId));
    } catch (error) {
        console.error('Failed to broadcast lobby options:', error);
    }
};
