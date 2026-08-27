import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import publicUserSelect from '../utils/publicUserSelect.js';
import { getRestaurantDetails } from './googlePlacesService.js';
import { emitLobbyOptions } from '../socket/emitter.js';

/**
 * Re-pulls a restaurant whose cached columns were purged, so a shortlisted
 * option never renders as a nameless card. Returns the row untouched if the
 * refetch fails — a stale option is better than a broken list.
 */
const rehydrate = async (restaurant) => {
    try {
        const details = await getRestaurantDetails(restaurant.api_place_id);
        return await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: {
                name: details.name,
                address: details.address,
                latitude: details.latitude ? parseFloat(details.latitude) : null,
                longitude: details.longitude ? parseFloat(details.longitude) : null,
                rating: details.rating ? parseFloat(details.rating) : null,
                price_level: details.price_level,
                photo_url: details.photo_url,
                primary_type: details.primary_type,
                user_rating_count: details.user_rating_count,
                phone_number: details.phone_number,
                website_url: details.website_url,
                google_maps_url: details.google_maps_url,
                opening_hours: details.opening_hours,
                cached_at: new Date()
            }
        });
    } catch {
        console.error('Failed to auto-refetch purged lobby option:', restaurant.api_place_id);
        return restaurant;
    }
};

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
        // A null name means the cache purge got to it before we did.
        if (!option.restaurant.name) {
            option.restaurant = await rehydrate(option.restaurant);
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
