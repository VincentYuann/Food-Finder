import axios from 'axios';
import prisma from '../config/dbConfig.js';
import myCache from '../utils/cache.js';
import { getPresignedUrl, cachePhotoToS3 } from '../services/s3Service.js';
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
        await prisma.$transaction(
            restaurants.map((restaurant) => prisma.restaurant.upsert({
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
                },
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
        const { latitude, longitude, radius = 5, keyword = 'restaurant', pageToken, rankPreference } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        const radiusNum = parseFloat(radius);
        const radiusMeters = Math.floor(radiusNum * 1609.34);

        // Prioritize DISTANCE if explicit rankPreference='DISTANCE' or if radius is <= 2 miles
        // Otherwise, keep Google's relevance ranking across broader areas
        const effectiveRankPreference = rankPreference || (radiusNum <= 2 ? 'DISTANCE' : null);

        const results = await searchNearbyRestaurants(
            parseFloat(latitude),
            parseFloat(longitude),
            radiusMeters,
            keyword,
            pageToken || null,
            effectiveRankPreference
        );

        cacheRestaurantsBackground(results.restaurants); // fire and forget
        res.json(results);
    } catch (error) {
        console.error('Error searching nearby restaurants:', error);
        res.status(500).json({ error: 'Failed to search nearby restaurants' });
    }
};

export const searchText = async (req, res) => {
    try {
        const { query, latitude, longitude, pageToken } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'query parameter is required' });
        }

        const results = await textSearchRestaurants(
            query,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
            pageToken || null
        );

        cacheRestaurantsBackground(results.restaurants); // fire and forget
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
            let rest = item.restaurant;
            // Graceful self-healing only if a legacy unpopulated record exists
            if (!rest.name && rest.api_place_id) {
                try {
                    const fresh = await getRestaurantDetails(rest.api_place_id);
                    rest = await prisma.restaurant.update({
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
                } catch (err) {
                    console.error('Failed to self-heal saved restaurant:', rest.api_place_id, err.message);
                }
            }
            return {
                saved_at: item.saved_at,
                ...rest
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
        // Check if restaurant is already cached and whether it already has an S3 photo
        const existing = await prisma.restaurant.findUnique({
            where: { api_place_id }
        });

        let finalPhotoUrl = existing?.photo_url || photo_url;

        const restaurant = await prisma.restaurant.upsert({
            where: { api_place_id },
            update: { 
                cached_at: new Date(),
                primary_type: primary_type,
                user_rating_count: user_rating_count,
                photo_url: finalPhotoUrl
            },
            create: {
                api_place_id,
                name,
                address,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                rating: rating ? parseFloat(rating) : null,
                price_level,
                photo_url: finalPhotoUrl,
                primary_type,
                user_rating_count
            }
        });

        await prisma.savedRestaurant.create({
            data: { user_id: req.user.id, restaurant_id: restaurant.id }
        });
        myCache.del(`user_saved_restaurants_${req.user.id}`);
        myCache.del(`user_saved_place_ids_${req.user.id}`);

        // Respond immediately for instant user feedback
        res.status(201).json({ message: 'Saved successfully', restaurant });

        // Background: If not already in S3, asynchronously cache photo to S3 and update DB record
        const isAlreadyS3 = finalPhotoUrl && (finalPhotoUrl.includes('s3%3A') || finalPhotoUrl.startsWith('s3:'));
        if (!isAlreadyS3 && finalPhotoUrl && process.env.S3_BUCKET) {
            (async () => {
                let photoName = null;
                if (finalPhotoUrl.includes('/api/restaurants/photo/')) {
                    photoName = decodeURIComponent(finalPhotoUrl.split('/api/restaurants/photo/')[1].split('?')[0]);
                } else if (finalPhotoUrl.startsWith('places/')) {
                    photoName = finalPhotoUrl;
                }

                if (photoName && !photoName.startsWith('s3:') && process.env.GOOGLE_PLACES_API_KEY) {
                    try {
                        const googleMediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${process.env.GOOGLE_PLACES_API_KEY}`;
                        const s3Key = await cachePhotoToS3(googleMediaUrl);
                        if (s3Key && s3Key.startsWith('s3:')) {
                            const s3PhotoUrl = `/api/restaurants/photo/${encodeURIComponent(s3Key)}`;
                            await prisma.restaurant.update({
                                where: { id: restaurant.id },
                                data: { photo_url: s3PhotoUrl }
                            });
                        }
                    } catch (s3Err) {
                        console.warn('Could not cache saved restaurant photo to S3, using proxy URL:', s3Err.message);
                    }
                }
            })().catch(err => console.error('Background S3 caching failed:', err));
        }
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

/**
 * Streams (or redirects to) a Google Places photo by its photo name.
 *
 * Google hands back a 302 to a short-lived CDN URL for most photos; passing
 * that redirect through means the bytes never touch this server.
 */
const serveGooglePhoto = async (res, photoName, maxWidth, cacheKey) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const googleUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;

    const response = await axios.get(googleUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
    });

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    if (response.status === 302 && response.headers.location) {
        const redirectUrl = response.headers.location;
        if (cacheKey) myCache.set(cacheKey, redirectUrl, 86400);
        return res.redirect(307, redirectUrl);
    }

    // Direct image binary response (stream through to client)
    const imgResponse = await axios.get(googleUrl, { responseType: 'stream' });
    res.set('Content-Type', imgResponse.headers['content-type'] || 'image/jpeg');
    return imgResponse.data.pipe(res);
};

export const proxyPhoto = async (req, res) => {
    const photoName = req.params.photoName;
    const maxWidth = req.query.maxWidth || 400;
    const cacheKey = `photo_redirect_${photoName}`;

    try {
        if (myCache.has(cacheKey)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
            return res.redirect(307, myCache.get(cacheKey));
        }

        // Backwards compatibility for any legacy S3-prefixed photos
        if (photoName.startsWith('s3:')) {
            const s3Key = photoName.replace('s3:', '');
            const presignedUrl = await getPresignedUrl(s3Key);
            if (presignedUrl) {
                myCache.set(cacheKey, presignedUrl, 7000);
                res.setHeader('Cache-Control', 'public, max-age=7000');
                return res.redirect(307, presignedUrl);
            }
            return res.status(404).send('Photo not found');
        }

        return serveGooglePhoto(res, photoName, maxWidth, cacheKey);
    } catch (error) {
        console.error('Photo proxy error:', error.message);
        res.status(500).send('Failed to load photo');
    }
};
