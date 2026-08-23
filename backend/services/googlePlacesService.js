import axios from 'axios';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Create an Axios instance for the New Places API
const placesClient = axios.create({
    baseURL: 'https://places.googleapis.com/v1',
    headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY
    }
});

/**
 * Generate a URL for a Google Places photo using the New API
 * @param {string} photoName - Photo name from Google Places API (e.g. places/.../photos/...)
 * @param {number} maxWidth - Maximum width of the image (default 400)
 * @returns {string} - Full photo URL
 */
function getPhotoUrl(photoName, maxWidth = 400) {
    // Generate a proxy URL so the API key never reaches the frontend.
    // The photoName looks like "places/ChIJ.../photos/A...". We URL-encode it.
    return `/api/restaurants/photo/${encodeURIComponent(photoName)}?maxWidth=${maxWidth}`;
}

/**
 * Search for restaurants near a location using Google Places API (New)
 * @param {number} latitude - Latitude of search center
 * @param {number} longitude - Longitude of search center
 * @param {number} radiusMeters - Search radius in meters
 * @param {string} keyword - Optional keyword filter (e.g., "sushi", "pizza")
 * @returns {Promise<Array>} - Array of restaurant results
 */
export async function searchNearbyRestaurants(latitude, longitude, radiusMeters = 1500, keyword = 'restaurant') {
    try {
        const response = await placesClient.post('/places:searchText', {
            textQuery: keyword,
            locationBias: {
                circle: {
                    center: { latitude, longitude },
                    radius: radiusMeters
                }
            }
        }, {
            headers: {
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.photos,places.primaryTypeDisplayName,places.types,places.userRatingCount,places.regularOpeningHours.openNow'
            }
        });

        if (!response.data.places) return [];

        return response.data.places.map(place => ({
            api_place_id: place.id,
            name: place.displayName?.text || 'Unknown',
            address: place.formattedAddress,
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            rating: place.rating ?? null,
            user_rating_count: place.userRatingCount ?? null,
            price_level: place.priceLevel ? (place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? 1 : place.priceLevel === 'PRICE_LEVEL_MODERATE' ? 2 : place.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 : place.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? 4 : null) : null,
            photo_url: place.photos?.[0]?.name ? getPhotoUrl(place.photos[0].name) : null,
            is_open: place.regularOpeningHours?.openNow ?? null,
            primary_type: place.primaryTypeDisplayName?.text || place.types?.[0] || 'Restaurant'
        }));
    } catch (error) {
        console.error('Google Places search error:', error.message);
        throw error;
    }
}

/**
 * Text search for restaurants
 * @param {string} query - Search query (e.g., "sushi in San Francisco")
 * @param {number} latitude - Optional: latitude for location bias
 * @param {number} longitude - Optional: longitude for location bias
 * @returns {Promise<Array>} - Array of search results
 */
export async function textSearchRestaurants(query, latitude = null, longitude = null) {
    try {
        const body = {
            textQuery: query
        };

        if (latitude && longitude) {
            // Default 5 miles bias if lat/lng is provided
            body.locationBias = {
                circle: {
                    center: { latitude, longitude },
                    radius: 8000
                }
            };
        }

        const response = await placesClient.post('/places:searchText', body, {
            headers: {
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.photos,places.primaryTypeDisplayName,places.types,places.userRatingCount,places.regularOpeningHours.openNow'
            }
        });

        if (!response.data.places) return [];

        return response.data.places.map(place => ({
            api_place_id: place.id,
            name: place.displayName?.text || 'Unknown',
            address: place.formattedAddress,
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            rating: place.rating ?? null,
            user_rating_count: place.userRatingCount ?? null,
            price_level: place.priceLevel ? (place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? 1 : place.priceLevel === 'PRICE_LEVEL_MODERATE' ? 2 : place.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 : place.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? 4 : null) : null,
            photo_url: place.photos?.[0]?.name ? getPhotoUrl(place.photos[0].name) : null,
            is_open: place.regularOpeningHours?.openNow ?? null,
            primary_type: place.primaryTypeDisplayName?.text || place.types?.[0] || 'Restaurant'
        }));
    } catch (error) {
        console.error('Google Places text search error:', error.message);
        throw error;
    }
}

/**
 * Get detailed information about a specific restaurant
 * @param {string} placeId - Google Place ID
 * @returns {Promise<Object>} - Detailed place information
 */
export async function getRestaurantDetails(placeId) {
    try {
        const response = await placesClient.get(`/places/${placeId}`, {
            headers: {
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,priceLevel,photos,primaryTypeDisplayName,types,userRatingCount,regularOpeningHours.openNow,regularOpeningHours.weekdayDescriptions,websiteUri,nationalPhoneNumber,googleMapsUri,reviews'
            }
        });

        const place = response.data;
        return {
            api_place_id: place.id,
            name: place.displayName?.text || 'Unknown',
            address: place.formattedAddress,
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            rating: place.rating ?? null,
            user_rating_count: place.userRatingCount ?? null,
            price_level: place.priceLevel ? (place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? 1 : place.priceLevel === 'PRICE_LEVEL_MODERATE' ? 2 : place.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 : place.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? 4 : null) : null,
            photo_url: place.photos?.[0]?.name ? getPhotoUrl(place.photos[0].name) : null,
            is_open: place.regularOpeningHours?.openNow ?? null,
            primary_type: place.primaryTypeDisplayName?.text || place.types?.[0] || 'Restaurant',
            website_url: place.websiteUri || null,
            phone_number: place.nationalPhoneNumber || null,
            google_maps_url: place.googleMapsUri || null,
            opening_hours: place.regularOpeningHours?.weekdayDescriptions || null,
            reviews: place.reviews || []
        };
    } catch (error) {
        console.error('Google Places details error:', error.message);
        throw error;
    }
}