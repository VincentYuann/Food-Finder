const API_BASE_URL = 'http://localhost:5000';

// State
let currentLobby = null;
let currentUser = null; // We'll need this to know who is who
let currentLobbyId = null;

// Lobby names, usernames and restaurant names all come from other users,
// so anything interpolated into innerHTML has to be escaped first.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

document.addEventListener('DOMContentLoaded', async () => {
    const lobbyId = new URLSearchParams(window.location.search).get('id');
    if (!lobbyId) {
        window.location.replace('/index.html');
        return;
    }
    currentLobbyId = lobbyId;

    // We need to know who the current user is to render chat correctly and check permissions
    await loadProfile();

    // Load lobby details first, as other calls depend on it
    await loadLobbyDetails(lobbyId);

    // Once details are loaded, fetch other data in parallel
    if (currentLobby) {
        await Promise.all([
            loadLobbyMembers(lobbyId),
            loadLobbyRestaurants(lobbyId),
            loadLobbyMessages(lobbyId)
        ]);
    }
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

        document.getElementById('lobby-name').textContent = lobby.name || 'Untitled Lobby';

        const metaContainer = document.getElementById('lobby-meta-info');
        metaContainer.innerHTML = `
            <div class="meta-item">Status: <strong>${escapeHtml(lobby.status)}</strong></div>
            <div class="meta-item">Invite Code: <strong>${escapeHtml(lobby.invite_code || '—')}</strong></div>
            <div class="meta-item">Created by: <strong>@${escapeHtml(lobby.creator.username)}</strong></div>
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

async function loadLobbyMessages(lobbyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}/messages`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load messages');

        const messages = await response.json();
        renderMessages(messages);
    } catch (error) {
        console.error(error);
        document.getElementById('chat-messages').innerHTML =
            '<div class="chat-system-message">Could not load messages.</div>';
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
        const firstLetter = escapeHtml(user.username.charAt(0));

        return `
            <li class="${isCreator ? 'member-creator' : ''}">
                <div class="member-avatar">${firstLetter}</div>
                <span class="member-name">${escapeHtml(user.username)}</span>
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

    const fallbackHTML = '<div class="no-image">📷 No photo</div>';

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
                    ${restaurant.photo_url
                        ? `<img src="${escapeHtml(restaurant.photo_url)}" alt="${escapeHtml(restaurant.name)}"/>`
                        : fallbackHTML}
                </div>
                <div class="restaurant-info">
                    <div class="restaurant-name">${escapeHtml(restaurant.name)}</div>
                    <div class="restaurant-meta">${ratingHTML} ${priceHTML}</div>
                    <div class="restaurant-address">${escapeHtml(restaurant.address || '')}</div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="alert('Voting coming soon!')">Vote</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Swap in the placeholder if a cached photo URL has gone stale. Wired up here
    // rather than with an inline onerror so the fallback markup doesn't have to be
    // escaped into an HTML attribute.
    container.querySelectorAll('.restaurant-image img').forEach(img => {
        img.addEventListener('error', () => {
            img.parentElement.innerHTML = fallbackHTML;
        });
    });
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');

    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="chat-system-message">Be the first to send a message!</div>`;
        return;
    }

    container.innerHTML = messages.map(message => {
        const isOwn = currentUser && message.user_id === currentUser.id;
        const author = message.user ? message.user.username : 'Unknown';
        const time = new Date(message.sent_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
        });

        return `
            <div class="chat-message ${isOwn ? 'own-message' : ''}">
                <div class="chat-message-meta">
                    <span class="chat-author">@${escapeHtml(author)}</span>
                    <span class="chat-time">${escapeHtml(time)}</span>
                </div>
                <div class="chat-bubble">${escapeHtml(message.content || '')}</div>
            </div>
        `;
    }).join('');

    // Newest messages are at the bottom, so land the user there.
    container.scrollTop = container.scrollHeight;
}

// --- Chat ---

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !currentLobbyId) return;

    // Clear straight away so the box feels responsive; restore it if the send fails.
    input.value = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${currentLobbyId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to send message');

        await loadLobbyMessages(currentLobbyId);
    } catch (error) {
        console.error(error);
        input.value = content;
        alert('Could not send your message. Please try again.');
    }
});
