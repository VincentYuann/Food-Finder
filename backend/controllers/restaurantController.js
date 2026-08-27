import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import { cachePhotoToS3, getPresignedUrl, isS3Usable } from '../services/s3Service.js';
import {
    searchNearbyRestaurants,
    getRestaurantDetails,
    textSearchRestaurants
} from '../services/googlePlacesService.js';

/**
 * Caches search results in the background so the user isn't kept waiting on DB
 * writes. Deliberately not awaited by the handlers — a caching failure should
 * never turn a successful search into an error.
 */
const cacheRestaurantsBackground = async (restaurants) => {
    if (!restaurants || restaurants.length === 0) return;

    try {
        const enrichedRestaurants = await Promise.all(restaurants.map(async (r) => {
            let originalProxyUrl = r.photo_url;
            let pUrl = originalProxyUrl;
            if (pUrl && pUrl.includes('/api/restaurants/photo/')) {
                const photoName = decodeURIComponent(pUrl.split('/api/restaurants/photo/')[1].split('?')[0]);
                if (photoName.startsWith('s3:')) return r;
                const googleUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${process.env.GOOGLE_PLACES_API_KEY}`;
                const s3Url = await cachePhotoToS3(googleUrl);
                pUrl = (s3Url === googleUrl) ? originalProxyUrl : `/api/restaurants/photo/${encodeURIComponent(s3Url)}`;
            } else if (pUrl && pUrl.includes('googleapis.com')) {
                const s3Url = await cachePhotoToS3(pUrl);
                pUrl = (s3Url === pUrl) ? originalProxyUrl : `/api/restaurants/photo/${encodeURIComponent(s3Url)}`;
            }
            return { ...r, photo_url: pUrl };
        }));

        await prisma.$transaction(
            enrichedRestaurants.map((restaurant) => prisma.restaurant.upsert({
                where: { api_place_id: restaurant.api_place_id },
                update: { 
                    cached_at: new Date(),
                    name: restaurant.name,
                    photo_url: restaurant.photo_url,
                    address: restaurant.address,
                    latitude: restaurant.latitude ? parseFloat(restaurant.latitude) : null,
                    longitude: restaurant.longitude ? parseFloat(restaurant.longitude) : null,
                    rating: restaurant.rating ? parseFloat(restaurant.rating) : null,
                    price_level: restaurant.price_level,
                    primary_type: restaurant.primary_type,
                    user_rating_count: restaurant.user_rating_count
                }, // bump the cache time and update new fields if it already exists
                create: {
                    api_place_id: restaurant.api_place_id,
                    name: restaurant.name,
                    address: restaurant.address,
                    latitude: restaurant.latitude ? parseFloat(restaurant.latitude) : null,
                    longitude: restaurant.longitude ? parseFloat(restaurant.longitude) : null,
                    rating: restaurant.rating ? parseFloat(restaurant.rating) : null,
                    price_level: restaurant.price_level,
                    photo_url: restaurant.photo_url,
                    primary_type: restaurant.primary_type,
                    user_rating_count: restaurant.user_rating_count
                }
            }))
        );
    } catch (error) {
        console.error('Background caching failed:', error);
    }
};

// ==========================================
// SEARCH
// ==========================================

export const searchNearby = async (req, res) => {
    try {
        // radius is now passed in miles from frontend, convert to meters
        const { latitude, longitude, radius = 5, keyword = 'restaurant' } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        const radiusMeters = Math.floor(parseFloat(radius) * 1609.34);

        const results = await searchNearbyRestaurants(
            parseFloat(latitude),
            parseFloat(longitude),
            radiusMeters,
            keyword
        );

        cacheRestaurantsBackground(results); // fire and forget
        res.json(results);
    } catch (error) {
        console.error('Error searching nearby restaurants:', error);
        res.status(500).json({ error: 'Failed to search nearby restaurants' });
    }
};

export const searchText = async (req, res) => {
    try {
        const { query, latitude, longitude } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'query parameter is required' });
        }

        const results = await textSearchRestaurants(
            query,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null
        );

        cacheRestaurantsBackground(results); // fire and forget
        res.json(results);
    } catch (error) {
        console.error('Error searching restaurants:', error);
        res.status(500).json({ error: 'Failed to search restaurants' });
    }
};

// ==========================================
// SAVED RESTAURANTS (per user)
// ==========================================

export const getSavedRestaurants = async (req, res) => {
    try {
        const cacheKey = `user_saved_restaurants_${req.user.id}`;
        if (myCache.has(cacheKey)) {
            return res.json(myCache.get(cacheKey));
        }
        const savedList = await prisma.savedRestaurant.findMany({
            where: { user_id: req.user.id },
            include: { restaurant: true },
            orderBy: { saved_at: 'desc' }
        });

        const restaurants = await Promise.all(savedList.map(async (item) => {
            let restaurant = item.restaurant;
            
            // Auto-refetch if the restaurant data was purged by the 30-day cron limit (name is null)
            if (!restaurant.name) {
                try {
                    const details = await getRestaurantDetails(restaurant.api_place_id);
                    restaurant = await prisma.restaurant.update({
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
                } catch (err) {
                    console.error('Failed to auto-refetch purged restaurant:', restaurant.api_place_id);
                }
            }

            return {
                saved_at: item.saved_at,
                ...restaurant
            };
        }));

        myCache.set(cacheKey, restaurants);
        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching saved restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch saved restaurants' });
    }
};

export const getSavedPlaceIds = async (req, res) => {
    try {
        const cacheKey = `user_saved_place_ids_${req.user.id}`;
        if (myCache.has(cacheKey)) {
            return res.json(myCache.get(cacheKey));
        }

        const savedList = await prisma.savedRestaurant.findMany({
            where: { user_id: req.user.id },
            include: { restaurant: { select: { api_place_id: true } } }
        });
        const placeIds = savedList.map(item => item.restaurant.api_place_id);
        myCache.set(cacheKey, placeIds);
        res.json(placeIds);
    } catch (error) {
        console.error('Error fetching saved place IDs:', error);
        res.status(500).json({ error: 'Failed to fetch saved place IDs' });
    }
};

export const saveRestaurant = async (req, res) => {
    const {
        api_place_id, name, address, latitude, longitude, rating, price_level, photo_url, primary_type, user_rating_count
    } = req.body;

    if (!api_place_id || !name) {
        return res.status(400).json({ error: 'api_place_id and name are required' });
    }

    try {
        // The restaurant may not be cached yet (or may have aged out), so make
        // sure it exists before linking the user to it.
        const restaurant = await prisma.restaurant.upsert({
            where: { api_place_id },
            update: { 
                cached_at: new Date(),
                primary_type: primary_type,
                user_rating_count: user_rating_count
            },
            create: {
                api_place_id,
                name,
                address,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                rating: rating ? parseFloat(rating) : null,
                price_level,
                photo_url,
                primary_type,
                user_rating_count
            }
        });

        await prisma.savedRestaurant.create({
            data: { user_id: req.user.id, restaurant_id: restaurant.id }
        });
        myCache.del(`user_saved_restaurants_${req.user.id}`);
        myCache.del(`user_saved_place_ids_${req.user.id}`);
        res.status(201).json({ message: 'Saved successfully', restaurant });
    } catch (error) {
        // P2002 = unique constraint violation, i.e. they already saved this one.
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Restaurant is already in your saved list' });
        }
        console.error('Error saving restaurant:', error);
        res.status(500).json({ error: 'Failed to save restaurant' });
    }
};

export const unsaveRestaurant = async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId, 10);

        if (Number.isNaN(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID' });
        }

        // Removes only the link, leaving the cached restaurant in place.
        await prisma.savedRestaurant.delete({
            where: {
                user_id_restaurant_id: {
                    user_id: req.user.id,
                    restaurant_id: restaurantId
                }
            }
        });

        myCache.del(`user_saved_restaurants_${req.user.id}`);
        myCache.del(`user_saved_place_ids_${req.user.id}`);
        res.status(204).send();
    } catch (error) {
        console.error('Error unsaving restaurant:', error);
        res.status(400).json({ error: 'Failed to remove restaurant from saved list' });
    }
};

// ==========================================
// RESTAURANT CACHE
// ==========================================

export const getDetails = async (req, res) => {
    try {
        const placeId = req.params.placeId;
        
        // CACHE-ASIDE PATTERN: Check DB first
        const existingRestaurant = await prisma.restaurant.findUnique({
            where: { api_place_id: placeId } // Accelerate Cache: 1 hr TTL, 1 day SWR
        });

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // If we have it, and we performed a deep fetch recently (checked via google_maps_url), return it
        if (existingRestaurant && existingRestaurant.google_maps_url && existingRestaurant.cached_at > oneWeekAgo) {
            console.log('Cache HIT for restaurant details:', placeId);
            return res.json(existingRestaurant);
        }

        console.log('Cache MISS for restaurant details. Fetching from Google...', placeId);
        
        // Fetch from Google
        const details = await getRestaurantDetails(placeId);

        // Upsert full details into DB
        const cached = await prisma.restaurant.upsert({
            where: { api_place_id: details.api_place_id },
            update: { 
                cached_at: new Date(),
                primary_type: details.primary_type,
                user_rating_count: details.user_rating_count,
                website_url: details.website_url,
                phone_number: details.phone_number,
                google_maps_url: details.google_maps_url,
                opening_hours: details.opening_hours
            },
            create: {
                api_place_id: details.api_place_id,
                name: details.name,
                address: details.address,
                latitude: details.latitude ? parseFloat(details.latitude) : null,
                longitude: details.longitude ? parseFloat(details.longitude) : null,
                rating: details.rating ? parseFloat(details.rating) : null,
                price_level: details.price_level,
                photo_url: details.photo_url,
                primary_type: details.primary_type,
                user_rating_count: details.user_rating_count,
                website_url: details.website_url,
                phone_number: details.phone_number,
                google_maps_url: details.google_maps_url,
                opening_hours: details.opening_hours
            }
        });

        // Mix the reviews back in for the frontend response (since we don't store them in DB to save space)
        res.json({ ...cached, reviews: details.reviews, is_open: details.is_open });
    } catch (error) {
        console.error('Error fetching restaurant details:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant details' });
    }
};

export const getAllRestaurants = async (req, res) => {
    try {
        const cacheKey = 'all_restaurants';
        if (myCache.has(cacheKey)) {
            return res.json(myCache.get(cacheKey));
        }
        const restaurants = await prisma.restaurant.findMany({
            orderBy: { cached_at: 'desc' },
            take: 50, // keep the payload sane; this is the whole shared cache
             // 15 mins TTL, 1 hr SWR
        });

        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
};

export const getRestaurantById = async (req, res) => {
    try {
        const cacheKey = `restaurant_by_id_${req.params.id}`;
        if (myCache.has(cacheKey)) {
            return res.json(myCache.get(cacheKey));
        }
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: parseInt(req.params.id, 10) } // 1 hr TTL, 1 day SWR
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        myCache.set(cacheKey, restaurant);
        res.json(restaurant);
    } catch (error) {
        console.error('Error fetching restaurant:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
};

export const removeLobbyRestaurant = async (req, res) => {
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
        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'That restaurant is not in this lobby.' });
        }
        console.error('Error removing lobby restaurant:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};


/**
 * Streams (or redirects to) a Google Places photo by its photo name.
 *
 * Google hands back a 302 to a short-lived CDN URL for most photos; passing
 * that redirect through means the bytes never touch this server. Older photos
 * come back inline, so both shapes are handled.
 */
const serveGooglePhoto = async (res, photoName, maxWidth, cacheKey) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const googleUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;

    const axios = (await import('axios')).default;
    const response = await axios.get(googleUrl, {
        maxRedirects: 0,
        responseType: 'arraybuffer',
        validateStatus: status => status >= 200 && status < 400
    });

    if (response.status === 302 && response.headers.location) {
        const redirectUrl = response.headers.location;
        if (cacheKey) myCache.set(cacheKey, redirectUrl);
        return res.redirect(redirectUrl);
    }

    res.set('Content-Type', response.headers['content-type']);
    return res.send(response.data);
};

/**
 * The Google photo name for whichever restaurant owns this cached S3 object.
 *
 * Caching a photo overwrites photo_url with the S3 key, which throws away the
 * Google photo name that produced it — so when S3 can't serve the object there
 * is nothing left to fall back to except the place id. The row is found by the
 * key's UUID rather than the whole path, because photo_url stores it
 * URL-encoded and the UUID is unique on its own.
 */
const googlePhotoNameForS3Key = async (s3Key) => {
    const uuid = s3Key.split('/').pop().replace(/\.[^.]+$/, '');
    if (!uuid) return null;

    const restaurant = await prisma.restaurant.findFirst({
        where: { photo_url: { contains: uuid } },
        select: { api_place_id: true }
    });
    if (!restaurant) return null;

    const details = await getRestaurantDetails(restaurant.api_place_id);
    // getPhotoUrl() formats this as '/api/restaurants/photo/<encoded>?maxWidth='
    const encoded = details?.photo_url?.split('/api/restaurants/photo/')[1];
    return encoded ? decodeURIComponent(encoded.split('?')[0]) : null;
};

export const proxyPhoto = async (req, res) => {
    const photoName = req.params.photoName;
    const maxWidth = req.query.maxWidth || 400;
    const cacheKey = `photo_redirect_${photoName}`;

    try {
        if (myCache.has(cacheKey)) {
            return res.redirect(myCache.get(cacheKey));
        }

        if (photoName.startsWith('s3:')) {
            const s3Key = photoName.replace('s3:', '');

            // Only redirect to S3 if the bucket is actually honouring our
            // signatures. A presigned URL is signed locally, so it looks
            // perfectly valid even when the credentials are stale - the
            // browser would just receive a 403 and render a broken image.
            if (await isS3Usable(s3Key)) {
                const presignedUrl = await getPresignedUrl(s3Key);
                if (presignedUrl) {
                    // Expires just inside the URL's own 2h lifetime.
                    myCache.set(cacheKey, presignedUrl, 7000);
                    return res.redirect(presignedUrl);
                }
            }

            // S3 is unreachable, so go back to the original source. The
            // resolution costs a Places lookup, hence caching the photo name
            // rather than repeating it for every card on the page.
            const nameKey = `s3_fallback_${s3Key}`;
            let fallbackName = myCache.get(nameKey);

            if (fallbackName === undefined) {
                fallbackName = await googlePhotoNameForS3Key(s3Key);
                // Held for a day rather than the cache's default hour: resolving
                // one of these costs a billable Places Details call, and a photo
                // name barely ever changes. Caching the misses too (as null)
                // stops a restaurant with no photo re-querying on every render.
                myCache.set(nameKey, fallbackName, 86400);
            }

            if (fallbackName) {
                // Deliberately not written back to photo_url: leaving the S3
                // key in place means these photos start serving from the cache
                // again the moment the credentials are fixed, with no backfill.
                return serveGooglePhoto(res, fallbackName, maxWidth, null);
            }

            return res.status(404).send('S3 photo not found');
        }

        return serveGooglePhoto(res, photoName, maxWidth, cacheKey);
    } catch (error) {
        console.error('Photo proxy error:', error.message);
        res.status(500).send('Failed to load photo');
    }
};
