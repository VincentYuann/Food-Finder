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
                update: { cached_at: new Date() }, // bump the cache time if it already exists
                create: {
                    api_place_id: restaurant.api_place_id,
                    name: restaurant.name,
                    address: restaurant.address,
                    latitude: restaurant.latitude ? parseFloat(restaurant.latitude) : null,
                    longitude: restaurant.longitude ? parseFloat(restaurant.longitude) : null,
                    rating: restaurant.rating ? parseFloat(restaurant.rating) : null,
                    price_level: restaurant.price_level,
                    photo_url: restaurant.photo_url
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
        const { latitude, longitude, radius = 1500, keyword = 'restaurant' } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        const results = await searchNearbyRestaurants(
            parseFloat(latitude),
            parseFloat(longitude),
            parseInt(radius, 10),
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

        // Flatten away the join table so the client gets a plain restaurant list.
        const restaurants = savedList.map((item) => ({
            saved_at: item.saved_at,
            ...item.restaurant
        }));

        res.json(restaurants);
    } catch (error) {
        console.error('Error fetching saved restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch saved restaurants' });
    }
};

export const saveRestaurant = async (req, res) => {
    const {
        api_place_id, name, address, latitude, longitude, rating, price_level, photo_url
    } = req.body;

    if (!api_place_id || !name) {
        return res.status(400).json({ error: 'api_place_id and name are required' });
    }

    try {
        // The restaurant may not be cached yet (or may have aged out), so make
        // sure it exists before linking the user to it.
        const restaurant = await prisma.restaurant.upsert({
            where: { api_place_id },
            update: { cached_at: new Date() },
            create: {
                api_place_id,
                name,
                address,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                rating: rating ? parseFloat(rating) : null,
                price_level,
                photo_url
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
        const details = await getRestaurantDetails(req.params.placeId);

        const cached = await prisma.restaurant.upsert({
            where: { api_place_id: details.api_place_id },
            update: { ...details, cached_at: new Date() },
            create: details
        });

        res.json(cached);
    } catch (error) {
        console.error('Error fetching restaurant details:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant details' });
    }
};

export const getAllRestaurants = async (req, res) => {
    try {
        const restaurants = await prisma.restaurant.findMany({
            orderBy: { cached_at: 'desc' },
            take: 50 // keep the payload sane; this is the whole shared cache
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
            where: { id: parseInt(req.params.id, 10) }
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
