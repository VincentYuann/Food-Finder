import prisma from '../config/dbConfig.js';
import { getRestaurantDetails } from '../services/googlePlacesService.js';

/**
 * Daily cache maintenance script complying with Google Places API Policies:
 * 1. Place IDs are exempt from caching restrictions and may be stored indefinitely.
 * 2. Cached place details/attributes must be refreshed or deleted after 30 calendar days.
 *
 * Strategy:
 * - Phase 1: Delete orphaned search cache records older than 30 days (unreferenced by any user or lobby).
 * - Phase 2: Refresh referenced records older than 30 days in the background via Google Places API,
 *   updating their attributes and setting cached_at = new Date() without blocking any user requests.
 */
async function purgeStaleCache() {
    console.log('Starting Google Places ToS 30-day cache maintenance...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        // Phase 1: Purge unreferenced orphaned search results older than 30 days
        const deleteResult = await prisma.restaurant.deleteMany({
            where: {
                cached_at: { lt: thirtyDaysAgo },
                saved_by: { none: {} },
                chosen_by_lobbies: { none: {} },
                lobby_options: { none: {} },
                votes: { none: {} }
            }
        });
        console.log(`[Phase 1] Purged ${deleteResult.count} stale orphaned search records.`);

        // Phase 2: Refresh referenced restaurants older than 30 days
        const staleReferenced = await prisma.restaurant.findMany({
            where: {
                cached_at: { lt: thirtyDaysAgo },
                OR: [
                    { saved_by: { some: {} } },
                    { chosen_by_lobbies: { some: {} } },
                    { lobby_options: { some: {} } },
                    { votes: { some: {} } }
                ]
            }
        });

        console.log(`[Phase 2] Refreshing ${staleReferenced.length} referenced restaurants older than 30 days...`);

        let refreshedCount = 0;
        for (const rest of staleReferenced) {
            try {
                const fresh = await getRestaurantDetails(rest.api_place_id);
                await prisma.restaurant.update({
                    where: { id: rest.id },
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
                refreshedCount += 1;
            } catch (err) {
                console.error(`[Phase 2] Failed to background-refresh restaurant ${rest.api_place_id}:`, err.message);
            }
        }

        console.log(`[Phase 2] Successfully refreshed ${refreshedCount} of ${staleReferenced.length} stale referenced restaurants.`);
    } catch (error) {
        console.error('Failed cache maintenance:', error);
    } finally {
        await prisma.$disconnect();
    }
}

purgeStaleCache();
