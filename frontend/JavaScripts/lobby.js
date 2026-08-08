const API_BASE_URL = 'http://localhost:5000';

// State
let currentLobby = null;
let currentUser = null; // We'll need this to know who is who

document.addEventListener('DOMContentLoaded', async () => {
    const lobbyId = new URLSearchParams(window.location.search).get('id');
    if (!lobbyId) {
        window.location.replace('/index.html');
        return;
    }

    // We need to know who the current user is to render chat correctly and check permissions
    await loadProfile();

    // Load lobby details first, as other calls depend on it
    await loadLobbyDetails(lobbyId);

    // Once details are loaded, fetch other data in parallel
    if (currentLobby) {
        await Promise.all([
            loadLobbyMembers(lobbyId),
            loadLobbyRestaurants(lobbyId)
            // loadLobbyMessages(lobbyId) // Placeholder for future implementation
        ]);
    }

    // Use mock/placeholder data for now to show the layout
    renderMessages([]);
});

async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Not authenticated');
        currentUser = await response.json();
    } catch (error) {
        console.error('Failed to load profile', error);
        // If profile fails, user is not logged in, so redirect.
        window.location.replace('/login.html');
    }
}

async function loadLobbyDetails(lobbyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            // If the user is not a member, the API will return 403/404. Redirect them.
            throw new Error('Failed to load lobby details or you are not a member.');
        }

        const lobby = await response.json();
        currentLobby = lobby;

        document.getElementById('lobby-name').textContent = lobby.name;

        const metaContainer = document.getElementById('lobby-meta-info');
        metaContainer.innerHTML = `
            <div class="meta-item">Status: <strong>${lobby.status}</strong></div>
            <div class="meta-item">Invite Code: <strong>${lobby.invite_code}</strong></div>
            <div class="meta-item">Created by: <strong>@${lobby.creator.username}</strong></div>
        `;

    } catch (error) {
        console.error(error);
        alert(error.message);
        window.location.replace('/index.html');
    }
}

async function loadLobbyRestaurants(lobbyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}/restaurants`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load lobby restaurants');
        const restaurantOptions = await response.json();
        renderRestaurants(restaurantOptions);
    } catch (error) {
        console.error(error);
        document.getElementById('lobby-restaurants-list').innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #d9534f;">Could not load restaurants.</p>`;
    }
}

async function loadLobbyMembers(lobbyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}/members`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load members');

        const members = await response.json();
        renderMembers(members);
    } catch (error) {
        console.error(error);
        document.getElementById('members-list').innerHTML = '<li>Error loading members.</li>';
    }
}

function renderMembers(members) {
    const list = document.getElementById('members-list');
    document.getElementById('member-count').textContent = members.length;

    if (members.length > 10) {
        list.classList.add('scrollable-list');
    } else {
        list.classList.remove('scrollable-list');
    }

    if (!members || members.length === 0) {
        list.innerHTML = '<li>No members found.</li>';
        return;
    }

    list.innerHTML = members.map(member => {
        const user = member.user;
        const isCreator = user.id === currentLobby.created_by;
        const firstLetter = user.username.charAt(0);

        return `
            <li class="${isCreator ? 'member-creator' : ''}">
                <div class="member-avatar">${firstLetter}</div>
                <span class="member-name">${user.username}</span>
            </li>
        `;
    }).join('');
}

function renderRestaurants(options) {
    const container = document.getElementById('lobby-restaurants-list');

    if (options.length > 10) {
        container.classList.add('scrollable-list');
    } else {
        container.classList.remove('scrollable-list');
    }

    if (!options || options.length === 0) {
        container.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #777;">No restaurants have been added yet. Use the "Add from Search" button!</p>`;
        return;
    }

    const fallbackHTML = `<div class=&quot;no-image&quot;>📷 No photo</div>`;

    container.innerHTML = options.map(option => {
        const restaurant = option.restaurant;
        const ratingHTML = restaurant.rating ? `
            <div class="rating">
                <span class="stars">★</span>
                <span>${parseFloat(restaurant.rating).toFixed(1)}</span>
            </div>
        ` : '';
        const priceHTML = restaurant.price_level ? `<div class="price-level">${'$'.repeat(restaurant.price_level)}</div>` : '';

        return `
            <div class="restaurant-card">
                <div class="restaurant-image">
                    ${restaurant.photo_url ? `<img src="${restaurant.photo_url}" alt="${restaurant.name}" onerror="this.parentElement.innerHTML='${fallbackHTML}'"/>` : fallbackHTML}
                </div>
                <div class="restaurant-info">
                    <div class="restaurant-name">${restaurant.name}</div>
                    <div class="restaurant-meta">${ratingHTML} ${priceHTML}</div>
                    <div class="restaurant-address">${restaurant.address}</div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="alert('Voting coming soon!')">Vote</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = `<div class="chat-system-message">Be the first to send a message!</div>`;
}