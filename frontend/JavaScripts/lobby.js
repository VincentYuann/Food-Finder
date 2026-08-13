// Lobby page: details, members, shortlisted restaurants and chat for one lobby.
// Depends on api.js (API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin).

let currentLobby = null;
let currentUser = null;
let currentLobbyId = null;

// Lists longer than this scroll inside their panel instead of growing the page.
const SCROLL_THRESHOLD = 10;

const NO_PHOTO_HTML = '<div class="no-image">📷 No photo</div>';

function setScrollable(container, itemCount) {
    container.classList.toggle('scrollable-list', itemCount > SCROLL_THRESHOLD);
}

function placeholder(text, color) {
    return `<p style="grid-column: 1 / -1; text-align: center; color: ${color};">${text}</p>`;
}

// ==========================================
// LOADING
// ==========================================

async function loadProfile() {
    try {
        const response = await apiFetch('/api/users/profile');
        if (!response.ok) throw new Error('Not authenticated');

        currentUser = await response.json();
    } catch (error) {
        console.error('Failed to load profile', error);
        redirectToLogin();
    }
}

async function loadLobbyDetails() {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}`);

        // Non-members get a 403 and people with a stale link get a 404.
        if (!response.ok) {
            throw new Error('Failed to load lobby details or you are not a member.');
        }

        currentLobby = await response.json();
        renderLobbyHeader(currentLobby);
    } catch (error) {
        console.error(error);
        alert(error.message);
        window.location.replace('/index.html');
    }
}

async function loadLobbyMembers() {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/members`);
        if (!response.ok) throw new Error('Failed to load members');

        renderMembers(await response.json());
    } catch (error) {
        console.error(error);
        document.getElementById('members-list').innerHTML = '<li>Error loading members.</li>';
    }
}

async function loadLobbyRestaurants() {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/restaurants`);
        if (!response.ok) throw new Error('Failed to load lobby restaurants');

        renderRestaurants(await response.json());
    } catch (error) {
        console.error(error);
        document.getElementById('lobby-restaurants-list').innerHTML =
            placeholder('Could not load restaurants.', '#d9534f');
    }
}

async function loadLobbyMessages() {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');

        renderMessages(await response.json());
    } catch (error) {
        console.error(error);
        document.getElementById('chat-messages').innerHTML =
            '<div class="chat-system-message">Could not load messages.</div>';
    }
}

// ==========================================
// RENDERING
// ==========================================

function renderLobbyHeader(lobby) {
    document.getElementById('lobby-name').textContent = lobby.name || 'Untitled Lobby';

    document.getElementById('lobby-meta-info').innerHTML = `
        <div class="meta-item">Status: <strong>${escapeHtml(lobby.status)}</strong></div>
        <div class="meta-item">Invite Code: <strong>${escapeHtml(lobby.invite_code || '—')}</strong></div>
        <div class="meta-item">Created by: <strong>@${escapeHtml(lobby.creator.username)}</strong></div>
    `;
}

function renderMembers(members) {
    const list = document.getElementById('members-list');
    document.getElementById('member-count').textContent = members.length;
    setScrollable(list, members.length);

    if (members.length === 0) {
        list.innerHTML = '<li>No members found.</li>';
        return;
    }

    list.innerHTML = members.map(({ user }) => {
        const isCreator = user.id === currentLobby.created_by;

        return `
            <li class="${isCreator ? 'member-creator' : ''}">
                <div class="member-avatar">${escapeHtml(user.username.charAt(0))}</div>
                <span class="member-name">${escapeHtml(user.username)}</span>
            </li>
        `;
    }).join('');
}

function restaurantCard(option) {
    const { restaurant } = option;

    const rating = restaurant.rating
        ? `<div class="rating">
               <span class="stars">★</span>
               <span>${parseFloat(restaurant.rating).toFixed(1)}</span>
           </div>`
        : '';
    const price = restaurant.price_level
        ? `<div class="price-level">${'$'.repeat(restaurant.price_level)}</div>`
        : '';
    const image = restaurant.photo_url
        ? `<img src="${escapeHtml(restaurant.photo_url)}" alt="${escapeHtml(restaurant.name)}"/>`
        : NO_PHOTO_HTML;

    return `
        <div class="restaurant-card">
            <div class="restaurant-image">${image}</div>
            <div class="restaurant-info">
                <div class="restaurant-name">${escapeHtml(restaurant.name)}</div>
                <div class="restaurant-meta">${rating} ${price}</div>
                <div class="restaurant-address">${escapeHtml(restaurant.address || '')}</div>
                <div class="action-buttons">
                    <button type="button" class="btn btn-primary" data-action="vote">Vote</button>
                </div>
            </div>
        </div>
    `;
}

function renderRestaurants(options) {
    const container = document.getElementById('lobby-restaurants-list');
    setScrollable(container, options.length);

    if (options.length === 0) {
        container.innerHTML = placeholder(
            'No restaurants have been added yet. Use the "Add from Search" button!',
            '#777'
        );
        return;
    }

    container.innerHTML = options.map(restaurantCard).join('');

    // Swap in the placeholder if a cached photo URL has gone stale. Done here
    // rather than with an inline onerror so the fallback markup doesn't have to
    // survive being escaped into an HTML attribute.
    container.querySelectorAll('.restaurant-image img').forEach((img) => {
        img.addEventListener('error', () => {
            img.parentElement.innerHTML = NO_PHOTO_HTML;
        });
    });
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');

    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-system-message">Be the first to send a message!</div>';
        return;
    }

    container.innerHTML = messages.map((message) => {
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

    // Newest messages sit at the bottom, so land the user there.
    container.scrollTop = container.scrollHeight;
}

// ==========================================
// CHAT
// ==========================================

async function sendMessage(event) {
    event.preventDefault();

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    // Clear straight away so the box feels responsive; put it back if the send fails.
    input.value = '';

    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/messages`, {
            method: 'POST',
            body: { content }
        });
        if (!response.ok) throw new Error('Failed to send message');

        await loadLobbyMessages();
    } catch (error) {
        console.error(error);
        input.value = content;
        alert('Could not send your message. Please try again.');
    }
}

// ==========================================
// SETUP
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    currentLobbyId = new URLSearchParams(window.location.search).get('id');
    if (!currentLobbyId) {
        window.location.replace('/index.html');
        return;
    }

    document.getElementById('chat-form').addEventListener('submit', sendMessage);
    document.getElementById('lobby-restaurants-list').addEventListener('click', (event) => {
        if (event.target.closest('button[data-action="vote"]')) {
            alert('Voting coming soon!');
        }
    });

    // Who the user is, then the lobby itself — the member list needs both to
    // work out which member is the host.
    await loadProfile();
    await loadLobbyDetails();

    if (currentLobby) {
        await Promise.all([
            loadLobbyMembers(),
            loadLobbyRestaurants(),
            loadLobbyMessages()
        ]);
    }
});
