// Restaurant search: nearby (needs geolocation) or by name.
// Depends on api.js (API_BASE_URL, apiFetch, escapeHtml).

let currentLocation = null;
let searchResults = [];

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
    const isSaved = Boolean(restaurant.saved);

    const image = restaurant.photo_url
        ? `<img src="${escapeHtml(restaurant.photo_url)}" alt="${escapeHtml(restaurant.name)}"/>`
        : NO_PHOTO_HTML;
    const rating = restaurant.rating
        ? `<div class="rating">
               <span class="stars">★</span>
               <span>${parseFloat(restaurant.rating).toFixed(1)}</span>
           </div>`
        : '';
    const price = restaurant.price_level
        ? `<div class="price-level">${'$'.repeat(restaurant.price_level)}</div>`
        : '';
    const openNow = restaurant.is_open !== null && restaurant.is_open !== undefined
        ? `<div class="is-open ${restaurant.is_open ? 'open' : 'closed'}">
               ${restaurant.is_open ? '✓ Open Now' : '✗ Closed'}
           </div>`
        : '';

    return `
        <div class="restaurant-card">
            <div class="restaurant-image">${image}</div>
            <div class="restaurant-info">
                <div class="restaurant-name">${escapeHtml(restaurant.name)}</div>
                <div class="restaurant-meta">${rating} ${price}</div>
                ${openNow}
                <div class="restaurant-address">${escapeHtml(formatAddress(restaurant.address))}</div>
                <div class="action-buttons">
                    <button class="btn-save ${isSaved ? 'saved' : ''}"
                            data-action="save" data-place-id="${escapeHtml(restaurant.api_place_id)}"
                            ${isSaved ? 'disabled' : ''}>
                        ${isSaved ? '✓ Saved' : '+ Save'}
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
                `📍 Location: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`,
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
    const query = document.getElementById('search-input').value.trim();

    if (!query) {
        showMessage('Please enter a search term', 'error');
        return;
    }

    // With a location we can do a proper radius search; without one, fall back
    // to a plain text search.
    if (currentLocation) {
        return runSearch('/api/restaurants/search/nearby', {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radius: document.getElementById('radius-input').value,
            keyword: query
        });
    }

    return runSearch('/api/restaurants/search/text', { query });
}

async function saveRestaurant(placeId) {
    const restaurant = searchResults.find((r) => r.api_place_id === placeId);
    if (!restaurant) {
        showMessage('Restaurant not found', 'error');
        return;
    }

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
                photo_url: restaurant.photo_url
            }
        });

        if (!response.ok) {
            throw new Error(`Save failed: ${response.status}`);
        }

        // Re-render so the button flips to its saved state.
        restaurant.saved = true;
        renderResults(searchResults);
        showMessage(`✓ ${restaurant.name} saved!`, 'success');
    } catch (error) {
        console.error('Save error:', error);
        showMessage(`Failed to save restaurant: ${error.message}`, 'error');
    }
}

// ==========================================
// SETUP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
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
            saveRestaurant(button.dataset.placeId);
        } else {
            // Placeholder for a future details modal/page.
            showMessage('Details page coming soon!', 'info');
        }
    });

    showMessage(
        'Ready to search. Enter a search term and click Search or use your location for nearby restaurants.',
        'info'
    );
});
