// Dashboard: the signed-in user's profile, saved restaurants and lobbies.
// Depends on api.js (API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin).
import {
    apiFetch, errorFrom, escapeHtml, redirectToLogin
} from './api.js';
import { openDetailsModal } from './modal.js';

// The signed-in user, needed to tell whether they host a given lobby.
let currentUser = null;

// Lists longer than this scroll inside the card instead of growing the page.
const SCROLL_THRESHOLD = 10;

// ==========================================
// SMALL DOM HELPERS
// ==========================================

const card = (text, extraClass = '') =>
    `<li class="dashboard-card ${extraClass}">${text}</li>`;

function setScrollable(list, itemCount) {
    list.classList.toggle('scrollable-list', itemCount > SCROLL_THRESHOLD);
}

function showLobbyError(message) {
    document.getElementById('lobby-error').textContent = message;
}

// ==========================================
// PROFILE
// ==========================================

async function loadProfile() {
    try {
        const response = await apiFetch('/api/users/profile');

        // A missing or expired cookie means they're not really signed in.
        if (!response.ok) {
            redirectToLogin();
            return;
        }

        currentUser = await response.json();
        document.getElementById('display-username').textContent = `@${currentUser.username}`;
        document.getElementById('display-email').textContent = currentUser.email;
    } catch (error) {
        console.error('Failed to load profile', error);
    }
}

// ==========================================
// SAVED RESTAURANTS
// ==========================================

function savedRestaurantCard(restaurant) {
    const rating = restaurant.rating
        ? `<div class="meta-item rating">
               <span class="stars">★</span>
               <span>${parseFloat(restaurant.rating).toFixed(1)}</span>
           </div>`
        : '';
        
    const cuisine = restaurant.primary_type
        ? `<div class="meta-item cuisine" style="color:#666; margin-left: 8px;">🍽️ ${escapeHtml(restaurant.primary_type)}</div>`
        : '';
        
    const image = restaurant.photo_url
        ? `<img src="${escapeHtml(restaurant.photo_url)}" alt="${escapeHtml(restaurant.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin-right: 15px;" />`
        : `<div style="width: 60px; height: 60px; background: #eee; border-radius: 8px; margin-right: 15px; display: flex; align-items: center; justify-content: center; font-size: 20px;">📸</div>`;

    return `
        <li class="dashboard-card" id="saved-restaurant-${restaurant.id}" style="display: flex; align-items: center; padding: 15px;">
            ${image}
            <div class="card-content" style="flex: 1;">
                <div class="card-title">${escapeHtml(restaurant.name)}</div>
                <div class="card-address">${escapeHtml(restaurant.address || 'Address not available')}</div>
                <div class="card-meta" style="display: flex; align-items: center; margin-top: 5px;">${rating}${cuisine}</div>
            </div>
            <div class="card-actions" style="display: flex; flex-direction: column; gap: 8px;">
                <button type="button" class="btn btn-details"
                        data-action="details" data-place-id="${escapeHtml(restaurant.api_place_id)}">Details</button>
                <button type="button" class="btn btn-danger"
                        data-action="unsave" data-restaurant-id="${restaurant.id}">Remove</button>
            </div>
        </li>
    `;
}

async function loadSavedRestaurants() {
    const list = document.getElementById('saved-list');
    list.innerHTML = card('Loading saved restaurants...');

    try {
        const response = await apiFetch('/api/restaurants/saved');
        if (!response.ok) {
            throw new Error(`Failed to load: ${response.statusText}`);
        }

        const saved = await response.json();
        setScrollable(list, saved.length);

        list.innerHTML = saved.length === 0
            ? card('No saved restaurants yet.')
            : saved.map(savedRestaurantCard).join('');
    } catch (error) {
        console.error('Failed to load saved restaurants', error);
        list.innerHTML = card('Could not load saved restaurants.', 'error-message');
    }
}

// Removing the row by hand keeps the page from flashing through a full reload.
async function unsaveRestaurant(restaurantId) {
    const el = document.getElementById(`saved-restaurant-${restaurantId}`);
    if (el) el.style.opacity = '0.5'; // optimistic UI feedback

    try {
        const response = await apiFetch(`/api/restaurants/saved/${restaurantId}`, { method: 'DELETE' });

        if (!response.ok) {
            console.error('Failed to remove restaurant.');
            if (el) el.style.opacity = '1';
            return;
        }

        if (el) el.remove();

        const list = document.getElementById('saved-list');
        if (list.children.length === 0) {
            list.innerHTML = card('No saved restaurants yet.');
        }
    } catch (error) {
        console.error('Failed to remove restaurant', error);
        if (el) el.style.opacity = '1';
    }
}

// ==========================================
// LOBBIES
// ==========================================

/**
 * The extra action a lobby card offers depends on who you are and whether the
 * lobby is still running:
 *   host + active   -> close it for everyone
 *   host + closed   -> delete it for everyone
 *   member + closed -> drop it from your own list (the API treats this as leaving)
 * The API enforces all of this as well; this only decides what to show.
 */
function lobbyActionButton(lobby, name) {
    const isHost = currentUser && lobby.created_by === currentUser.id;
    const isClosed = lobby.status === 'closed';
    const attrs = `data-lobby-id="${lobby.id}" data-lobby-name="${escapeHtml(name)}"`;

    if (isHost && !isClosed) {
        return `<button type="button" class="btn btn-warning" data-action="close" ${attrs}>Close</button>`;
    }
    if (isClosed) {
        return isHost
            ? `<button type="button" class="btn btn-danger" data-action="delete" ${attrs}>Delete</button>`
            : `<button type="button" class="btn btn-danger" data-action="leave" ${attrs}>Remove</button>`;
    }
    return '';
}

function lobbyCard(lobby) {
    const name = lobby.name || 'Untitled Lobby';

    return `
        <li class="dashboard-card">
            <div class="card-content">
                <div class="card-title">${escapeHtml(name)}</div>
                <div class="card-meta">
                    <div class="meta-item status status-${escapeHtml(lobby.status.toLowerCase())}">
                        Status: <strong>${escapeHtml(lobby.status)}</strong>
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <a href="/lobby.html?id=${lobby.id}" class="btn btn-primary">View Lobby</a>
                ${lobbyActionButton(lobby, name)}
            </div>
        </li>
    `;
}

async function loadLobbies() {
    const list = document.getElementById('lobby-list');
    list.innerHTML = card('Loading your lobbies...');

    try {
        const response = await apiFetch('/api/users/profile/lobbies');
        if (!response.ok) return;

        // The endpoint returns memberships; the lobby itself is nested inside.
        const memberships = await response.json();
        setScrollable(list, memberships.length);

        list.innerHTML = memberships.length === 0
            ? card('You have not joined any lobbies.')
            : memberships.map((membership) => lobbyCard(membership.lobby)).join('');
    } catch (error) {
        console.error('Failed to load lobbies', error);
        list.innerHTML = card('Could not load your lobbies.', 'error-message');
    }
}

async function createLobby(event) {
    event.preventDefault();
    showLobbyError('');

    const name = document.getElementById('create-lobby-name').value.trim();
    if (!name) return;

    try {
        const response = await apiFetch('/api/lobbies', { method: 'POST', body: { name } });

        if (!response.ok) {
            showLobbyError(await errorFrom(response, 'Could not create the lobby.'));
            return;
        }

        // Go straight to the new lobby so the host can grab the invite code.
        const lobby = await response.json();
        window.location.href = `/lobby.html?id=${lobby.id}`;
    } catch (error) {
        console.error('Failed to create lobby', error);
        showLobbyError('Server error. Please try again.');
    }
}

async function joinLobby(event) {
    event.preventDefault();
    showLobbyError('');

    const invite_code = document.getElementById('join-lobby-code').value.trim();
    if (!invite_code) return;

    try {
        const response = await apiFetch('/api/lobbies/join', { method: 'POST', body: { invite_code } });

        if (!response.ok) {
            showLobbyError(await errorFrom(response, 'Could not join the lobby.'));
            return;
        }

        const lobby = await response.json();
        window.location.href = `/lobby.html?id=${lobby.id}`;
    } catch (error) {
        console.error('Failed to join lobby', error);
        showLobbyError('Server error. Please try again.');
    }
}

// What each lobby action asks before it runs, and the request it then sends.
const LOBBY_ACTIONS = {
    close: {
        confirm: (name) => `Close "${name}"? Everyone will still see it, but the lobby stops being active.`,
        request: (lobbyId) => apiFetch(`/api/lobbies/${lobbyId}`, { method: 'PATCH', body: { status: 'closed' } })
    },
    delete: {
        confirm: (name) => `Permanently delete "${name}"? This removes it for every member and cannot be undone.`,
        request: (lobbyId) => apiFetch(`/api/lobbies/${lobbyId}`, { method: 'DELETE' })
    },
    leave: {
        confirm: (name) => `Remove "${name}" from your lobbies? You will leave the lobby.`,
        request: (lobbyId) => apiFetch(`/api/lobbies/${lobbyId}/members/${currentUser.id}`, { method: 'DELETE' })
    }
};

async function runLobbyAction(button) {
    const { action, lobbyId, lobbyName } = button.dataset;
    const { confirm: askFirst, request } = LOBBY_ACTIONS[action];

    if (!confirm(askFirst(lobbyName))) return;

    showLobbyError('');
    button.disabled = true;

    try {
        const response = await request(lobbyId);

        if (!response.ok) {
            showLobbyError(await errorFrom(response, 'That action did not go through.'));
            button.disabled = false;
            return;
        }

        await loadLobbies();
    } catch (error) {
        console.error(`Failed to ${action} lobby`, error);
        showLobbyError('Server error. Please try again.');
        button.disabled = false;
    }
}

// ==========================================
// SETUP
// ==========================================

async function logout() {
    try {
        await apiFetch('/api/users/logout', { method: 'POST' });
        redirectToLogin();
    } catch (error) {
        console.error('Logout failed', error);
    }
}

// Both lists are re-rendered from scratch, so their buttons are handled by a
// delegated listener on the list rather than one listener per button.
function wireUpListeners() {
    document.getElementById('create-lobby-form').addEventListener('submit', createLobby);
    document.getElementById('join-lobby-form').addEventListener('submit', joinLobby);
    document.getElementById('logout-btn').addEventListener('click', logout);

    document.getElementById('lobby-list').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (button) runLobbyAction(button);
    });

    document.getElementById('saved-list').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        if (button.dataset.action === 'unsave') {
            unsaveRestaurant(button.dataset.restaurantId);
        } else if (button.dataset.action === 'details') {
            openDetailsModal(button.dataset.placeId);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    wireUpListeners();

    // Profile first: the lobby cards need to know who the signed-in user is.
    await loadProfile();
    await loadSavedRestaurants();
    await loadLobbies();
});
