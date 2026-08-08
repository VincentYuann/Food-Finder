// Change this manually to 'https://api.yourdomain.com' only when deploying to the cloud.
const API_BASE_URL = 'http://localhost:5000';


document.addEventListener('DOMContentLoaded', async () => {

    // 1. Verify Authentication & Load Profile
    async function loadProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
                method: 'GET',
                credentials: 'include' // Attaches the HttpOnly cookie
            });

            if (!response.ok) {
                // If the HttpOnly cookie is missing or invalid, redirect to login via replace
                window.location.replace('/login.html');
                return;
            }

            const user = await response.json();
            document.getElementById('display-username').textContent = `@${user.username}`;
            document.getElementById('display-email').textContent = user.email;
        } catch (error) {
            console.error('Failed to load profile', error);
        }
    }

    // 2. Load Saved Restaurants
    async function loadSavedRestaurants() {
        const list = document.getElementById('saved-list');
        list.innerHTML = '<li class="dashboard-card">Loading saved restaurants...</li>';

        try {
            // Use the correct, existing endpoint from restaurantRoutes.js
            const response = await fetch(`${API_BASE_URL}/api/restaurants/saved`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }

            const saved = await response.json();

            if (saved.length > 10) {
                list.classList.add('scrollable-list');
            } else {
                list.classList.remove('scrollable-list');
            }

            if (saved.length === 0) {
                list.innerHTML = '<li class="dashboard-card">No saved restaurants yet.</li>';
                return;
            }

            // Adjust mapping to handle the cleaner data structure from /api/restaurants/saved
            list.innerHTML = saved.map(restaurant => {
                const ratingHTML = restaurant.rating ? `
                        <div class="meta-item rating">
                            <span class="stars">★</span>
                            <span>${parseFloat(restaurant.rating).toFixed(1)}</span>
                        </div>
                    ` : '';

                // Escape single quotes in the ID to prevent breaking the onclick attribute
                const escapedApiPlaceId = restaurant.api_place_id.replace(/'/g, "\\'");

                return `
                    <li class="dashboard-card" id="saved-restaurant-${restaurant.id}">
                        <div class="card-content">
                            <div class="card-title">${restaurant.name}</div>
                            <div class="card-address">${restaurant.address || 'Address not available'}</div>
                            <div class="card-meta">${ratingHTML}</div>
                        </div>
                        <div class="card-actions">
                            <a href="#" onclick="viewRestaurantDetails('${escapedApiPlaceId}')" class="btn btn-details">Details</a>
                            <button onclick="removeRestaurant(${restaurant.id})" class="btn btn-danger">Remove</button>
                        </div>
                    </li>
                `;
            }).join('');

        } catch (error) {
            console.error('Failed to load saved restaurants', error);
            // Add UI feedback for the error
            list.innerHTML = `<li class="dashboard-card error-message">Could not load saved restaurants.</li>`;
        }
    }

    // 3. Load Lobbies
    async function loadLobbies() {
        const list = document.getElementById('lobby-list');
        list.innerHTML = '<li class="dashboard-card">Loading your lobbies...</li>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/profile/lobbies`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const memberships = await response.json();

                if (memberships.length > 10) {
                    list.classList.add('scrollable-list');
                } else {
                    list.classList.remove('scrollable-list');
                }

                if (memberships.length === 0) {
                    list.innerHTML = '<li class="dashboard-card">You have not joined any lobbies.</li>';
                    return;
                }

                list.innerHTML = memberships.map(m => {
                    const lobby = m.lobby;
                    return `
                    <li class="dashboard-card">
                        <div class="card-content">
                            <div class="card-title">${lobby.name || 'Untitled Lobby'}</div>
                            <div class="card-meta">
                                <div class="meta-item status status-${lobby.status.toLowerCase()}">Status: <strong>${lobby.status}</strong></div>
                            </div>
                        </div>
                        <div class="card-actions">
                            <a href="/lobby.html?id=${lobby.id}" class="btn btn-primary">View Lobby</a>
                        </div>
                    </li>`;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to load lobbies', error);
            list.innerHTML = `<li class="dashboard-card error-message">Could not load your lobbies.</li>`;
        }
    }

    // 4. Handle Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE_URL}/api/users/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            window.location.replace('/login.html');
        } catch (error) {
            console.error('Logout failed', error);
        }
    });

    // Initialize the dashboard
    await loadProfile();
    await loadSavedRestaurants();
    await loadLobbies();
});

// Global function for the remove button to access
window.removeRestaurant = async (restaurantId) => {
    try {
        // Use the correct DELETE endpoint from restaurantRoutes.js
        const response = await fetch(`${API_BASE_URL}/api/restaurants/saved/${restaurantId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            // UX Improvement: Remove the element from the DOM without a full page reload.
            const elementToRemove = document.getElementById(`saved-restaurant-${restaurantId}`);
            if (elementToRemove) {
                elementToRemove.remove();
            }
            // If the list is now empty, show the "No saved" message.
            const list = document.getElementById('saved-list');
            if (list.children.length === 0) {
                list.innerHTML = '<li class="dashboard-card">No saved restaurants yet.</li>';
            }
        } else {
            alert('Failed to remove restaurant.');
        }
    } catch (error) {
        console.error('Failed to remove restaurant', error);
        alert('An error occurred while removing the restaurant.');
    }
};

// Global function for details link
window.viewRestaurantDetails = (apiPlaceId) => {
    // This is a placeholder. In the future, this could open a modal with details.
    alert(`Restaurant details for ${apiPlaceId} are coming soon!`);
};