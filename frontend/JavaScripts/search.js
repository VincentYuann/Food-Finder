// Restaurant search: nearby (needs geolocation) or by name.
// Depends on api.js (API_BASE_URL, apiFetch, escapeHtml).
import {
    apiFetch, escapeHtml
, getImageUrl } from './api.js';
import { openDetailsModal } from './modal.js';

let currentLocation = null;
let searchResults = [];
const savedPlaceIds = new Set();

const NO_PHOTO_HTML = '<div class="no-image">📷 No photo available</div>';

// ==========================================
// STATUS / FORMATTING
// ==========================================

function showMessage(text, type = 'info') {
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = text;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = text ? 'block' : 'none';
}

function showLoading(isLoading) {
    document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
}

function formatAddress(address) {
    if (!address) return 'Address not available';
    return address.length > 80 ? `${address.substring(0, 80)}...` : address;
}

// ==========================================
// RENDERING
// ==========================================

function restaurantCard(restaurant) {
    const isSaved = restaurant.saved || savedPlaceIds.has(restaurant.api_place_id);

    const image = restaurant.photo_url
        ? `<img src="${escapeHtml(getImageUrl(restaurant.photo_url))}" alt="${escapeHtml(restaurant.name)}"/>`
        : NO_PHOTO_HTML;
    const ratingHtml = restaurant.rating 
        ? `<div class="rating-badge" style="font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; color: #444;">
            <span class="stars"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> ${parseFloat(restaurant.rating).toFixed(1)}
           </div>`
        : '';
        
    const typeHtml = restaurant.primary_type 
        ? `<div class="cuisine-type" style="font-size: 0.85rem; color: #666; margin-bottom: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> ${escapeHtml(restaurant.primary_type)}</div>`
        : '';

    const price = restaurant.price_level
        ? `<div class="price-level">${'$'.repeat(restaurant.price_level)}</div>`
        : '';
    const openNow = restaurant.is_open !== null && restaurant.is_open !== undefined
        ? `<div class="is-open ${restaurant.is_open ? 'open' : 'closed'}">
               ${restaurant.is_open ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Open Now' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Closed'}
           </div>`
        : '';

    return `
        <div class="restaurant-card">
            <div class="restaurant-image">${image}</div>
            <div class="restaurant-info">
                <div class="restaurant-name">${escapeHtml(restaurant.name)}</div>
                ${typeHtml}
                <div class="restaurant-meta">${ratingHtml} ${price}</div>
                ${openNow}
                <div class="restaurant-address">${escapeHtml(formatAddress(restaurant.address))}</div>
                <div class="action-buttons">
                        <button type="button" class="btn btn-save ${isSaved ? 'saved' : ''}" data-action="save" data-place-id="${escapeHtml(restaurant.api_place_id)}" ${isSaved ? 'disabled' : ''}>
                        ${isSaved ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Saved' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Save'}
                        </button>
                    <button class="btn-details"
                            data-action="details" data-place-id="${escapeHtml(restaurant.api_place_id)}">Details</button>
                </div>
            </div>
        </div>
    `;
}

function renderResults(results) {
    const container = document.getElementById('results-container');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1;">
                <h3>No restaurants found</h3>
                <p>Try adjusting your search criteria or location</p>
            </div>
        `;
        return;
    }

    container.innerHTML = results.map(restaurantCard).join('');

    // Fall back to the placeholder when a photo URL fails to load.
    container.querySelectorAll('.restaurant-image img').forEach((img) => {
        img.addEventListener('error', () => {
            img.parentElement.innerHTML = NO_PHOTO_HTML;
        });
    });
}

// ==========================================
// GEOLOCATION
// ==========================================

function getCurrentLocation() {
    const button = document.getElementById('use-location-btn');

    if (!navigator.geolocation) {
        showMessage('Geolocation is not supported by your browser', 'error');
        return;
    }

    showMessage('Getting your location...', 'info');
    button.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            showMessage(
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> Location: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`,
                'success'
            );
            button.disabled = false;
        },
        (error) => {
            showMessage(`Location error: ${error.message}`, 'error');
            button.disabled = false;
        }
    );
}

// ==========================================
// SEARCHING
// ==========================================

// Both searches differ only in which endpoint and parameters they use, so the
// request/render/error handling lives here once.
async function runSearch(path, params) {
    showLoading(true);
    showMessage('Searching...', 'loading');

    try {
        const query = new URLSearchParams(params).toString();
        const response = await apiFetch(`${path}?${query}`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        searchResults = await response.json();
        renderResults(searchResults);
        showMessage(`Found ${searchResults.length} restaurants`, 'success');
    } catch (error) {
        console.error('Search error:', error);
        showMessage(`Search failed: ${error.message}`, 'error');
        renderResults([]);
    } finally {
        showLoading(false);
    }
}

function search() {
    const nameQuery = document.getElementById('search-input').value.trim();
    const cuisineQuery = document.getElementById('cuisine-input').value;

    const queryParts = [];
    if (cuisineQuery) queryParts.push(cuisineQuery);
    if (nameQuery) queryParts.push(nameQuery);
    
    const finalQuery = queryParts.join(' ') || 'restaurant';

    // With a location we can do a proper radius search; without one, fall back
    // to a plain text search.
    if (currentLocation) {
        return runSearch('/api/restaurants/search/nearby', {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radius: document.getElementById('radius-input').value, // Now in miles
            keyword: finalQuery
        });
    }

    return runSearch('/api/restaurants/search/text', { query: finalQuery });
}

async function saveRestaurant(placeId, buttonElement) {
    const restaurant = searchResults.find((r) => r.api_place_id === placeId);
    if (!restaurant) return;

    // Optimistic UI Update immediately so the user can't re-click
    buttonElement.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Saved';
    buttonElement.disabled = true;
    buttonElement.classList.add('saved');

    try {
        const response = await apiFetch('/api/restaurants/save', {
            method: 'POST',
            body: {
                api_place_id: restaurant.api_place_id,
                name: restaurant.name,
                address: restaurant.address,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
                rating: restaurant.rating,
                price_level: restaurant.price_level,
                photo_url: restaurant.photo_url,
                primary_type: restaurant.primary_type,
                user_rating_count: restaurant.user_rating_count
            }
        });

        if (!response.ok) {
            const err = await response.json();
            if (err.error && err.error.includes('already')) {
                // Silently succeed UI-wise
            } else {
                throw new Error(`Save failed: ${response.status}`);
            }
        } else {
            restaurant.saved = true;
            savedPlaceIds.add(restaurant.api_place_id);
            showMessage(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ${restaurant.name} saved!`, 'success');
        }
    } catch (error) {
        console.error('Save error:', error);
        // The user explicitly asked to keep the button disabled and not revert the UI
    }
}

// ==========================================
// SETUP
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Sync saved places so buttons load in the correct state
    try {
        const response = await apiFetch('/api/restaurants/saved');
        if (response.ok) {
            const savedList = await response.json();
            savedList.forEach(r => savedPlaceIds.add(r.api_place_id));
        }
    } catch (e) {
        console.error('Failed to sync saved restaurants', e);
    }

    document.getElementById('search-btn').addEventListener('click', search);
    document.getElementById('use-location-btn').addEventListener('click', getCurrentLocation);

    document.getElementById('search-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') search();
    });

    // Result cards are re-rendered on every search, so handle their buttons here.
    document.getElementById('results-container').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        if (button.dataset.action === 'save') {
            saveRestaurant(button.dataset.placeId, button);
        } else if (button.dataset.action === 'details') {
            openDetailsModal(button.dataset.placeId);
        }
    });

    showMessage(
        'Ready to search. Enter a search term and click Search or use your location for nearby restaurants.',
        'info'
    );
});
