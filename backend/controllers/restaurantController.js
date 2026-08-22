import prisma from '../config/dbConfig.js';
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

        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching saved restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch saved restaurants' });
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
            where: { api_place_id: placeId },
            cacheStrategy: { ttl: 60 * 60, swr: 60 * 60 * 24 } // Accelerate Cache: 1 hr TTL, 1 day SWR
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
        const restaurants = await prisma.restaurant.findMany({
            orderBy: { cached_at: 'desc' },
            take: 50, // keep the payload sane; this is the whole shared cache
            cacheStrategy: { ttl: 60 * 15, swr: 60 * 60 } // 15 mins TTL, 1 hr SWR
        });

        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
};

export const getRestaurantById = async (req, res) => {
    try {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: parseInt(req.params.id, 10) },
            cacheStrategy: { ttl: 60 * 60, swr: 60 * 60 * 24 } // 1 hr TTL, 1 day SWR
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

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
