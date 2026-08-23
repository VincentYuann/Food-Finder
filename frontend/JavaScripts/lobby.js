/* global io */
// Lobby page: details, members, shortlisted restaurants and chat for one lobby.
// Depends on api.js (API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin).
import {
    API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin
, getImageUrl } from './api.js';

let currentLobby = null;
let currentUser = null;
let currentLobbyId = null;

// Socket.IO connection carrying this lobby's live updates - chat messages and
// the member list - and whether it has actually joined the lobby's room.
// Sending falls back to the REST endpoint while it hasn't.
let socket = null;
let lobbyConnected = false;

// Lists longer than this scroll inside their panel instead of growing the page.
const SCROLL_THRESHOLD = 10;
const NO_PHOTO_HTML = '<div class="no-image">📸 No photo</div>';

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
        if (currentOptions.length > 0) renderRestaurants();
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

let currentVotes = [];
async function loadLobbyVotes() {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/votes`);
        if (!response.ok) throw new Error('Failed to load votes');
        currentVotes = await response.json();
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// RENDERING
// ==========================================

function renderLobbyHeader(lobby) {
    document.getElementById('lobby-name').textContent = lobby.name || 'Untitled Lobby';
    const isCreator = currentUser && lobby.creator && currentUser.id === lobby.creator.id;
    document.getElementById('lobby-meta-info').innerHTML = `
        <div class="meta-item">Status: <strong>${escapeHtml(lobby.status)}</strong></div>
        <div class="meta-item">Invite Code: <strong>${escapeHtml(lobby.invite_code || '—')}</strong></div>
        <div class="meta-item">Created by: <strong>@${escapeHtml(lobby.creator.username)}</strong></div>
    `;

    if (isCreator) {
        if (currentLobby.status === 'closed') {
            document.getElementById('lobby-action-container').innerHTML = `<button id="close-lobby-btn" class="btn" style="color: #dc3545; border-color: #dc3545; background-color: #fff;" disabled>Lobby Closed</button>`;
        } else {
            const actionName = currentLobby.status === 'active' ? 'Start Voting' : 'Close Lobby';
            document.getElementById('lobby-action-container').innerHTML = `<button id="close-lobby-btn" class="btn btn-warning" disabled>${actionName}</button>`;
        }
    }
}

function renderMembers(members) {
    const list = document.getElementById('members-list');
    document.getElementById('member-count').textContent = members.length;
    setScrollable(list, members.length);

    if (members.length === 0) {
        list.innerHTML = '<li>No members found.</li>';
        return;
    }

    // members is an array of LobbyMember { id, lobby_id, user_id, joined_at, ready, user: { ... } }
    list.innerHTML = members.map((m) => {
        const user = m.user;
        const isCreator = user.id === currentLobby.created_by;
        const isCurrent = currentUser && user.id === currentUser.id;
        const readyBadge = m.ready
            ? `<span class="ready-badge">Ready</span>`
            : `<span class="not-ready-badge">Not ready</span>`;

        // show a toggle button to mark ready/unready
        if (isCurrent && !isCreator) {
            const actionContainer = document.getElementById('lobby-action-container');
            if (actionContainer) {
                if (currentLobby.status === 'closed') {
                    actionContainer.innerHTML = `<button type="button" class="btn" style="color: #dc3545; border-color: #dc3545; background-color: #fff;" disabled>Lobby Closed</button>`;
                } else {
                    let readyText = 'Ready';
                    if (currentLobby.status === 'active') {
                        readyText = 'Ready to vote';
                    } else if (currentLobby.status === 'voting') {
                        readyText = 'Ready to close';
                    }
                    actionContainer.innerHTML = `<button type="button" class="btn btn-secondary" data-action="toggle-ready" data-ready="${m.ready}">${m.ready ? 'Unready' : readyText}</button>`;
                }
            }
        }

        const creatorClass = isCreator ? 'member-creator' : '';

        return `
            <li class="${creatorClass}" data-user-id="${user.id}" data-ready="${m.ready}">
                <div class="member-avatar">${escapeHtml(user.username.charAt(0))}</div>
                <span class="member-name">${escapeHtml(user.username)}${isCreator ? ' (host)' : ''}</span>
                <span class="member-ready">${readyBadge}</span>
            </li>
        `;
    }).join('');

    updateCloseButtonState(members);
}

function updateCloseButtonState(members) {
    const btn = document.getElementById('close-lobby-btn');
    if (!btn) return;

    if (currentLobby.status === 'closed') {
        btn.disabled = true;
        btn.textContent = 'Lobby Closed';
        btn.style.color = '#dc3545';
        btn.style.borderColor = '#dc3545';
        btn.style.backgroundColor = '#fff';
        return;
    }

    const totalMembers = members.length;
    const readyCount = members.filter((m) => m.ready).length;
    const required = Math.max(0, totalMembers - 1);
    const canClose = readyCount >= required;

    btn.disabled = !canClose;
    const actionName = currentLobby.status === 'active' ? 'Start Voting' : 'Close Lobby';
    btn.textContent = `${actionName} (${readyCount}/${totalMembers} ready)`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action="toggle-ready"]');
        if (btn) {
            const currentReady = btn.dataset.ready === 'true';
            await toggleMyReady(!currentReady);
        }

        if (event.target && event.target.id === 'close-lobby-btn') {
            closeLobby();
        }
    });
});

// toggle ready/unready
async function toggleMyReady(newReady) {
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/members/ready`, {
            method: 'PATCH',
            body: { ready: newReady }
        });
        if (!response.ok) {
            throw new Error(await errorFrom(response, 'Could not update ready state'));
        }
        // The server broadcasts the new list to the room, this tab included,
        // but refetch anyway so the badge still flips when the socket is down.
        await loadLobbyMembers();
    } catch (error) {
        console.error('Failed to update ready state', error);
        alert(error.message || 'Could not update ready state.');
    }
}

// progress lobby (for creators)
async function closeLobby() {
    const isVotingNext = currentLobby.status === 'active';
    const nextStatus = isVotingNext ? 'voting' : 'closed';
    const promptMsg = isVotingNext 
        ? 'Are you ready to start voting?' 
        : 'Close the lobby for everyone? This cannot be undone.';
        
    if (!confirm(promptMsg)) return;
    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}`, {
            method: 'PATCH',
            body: { status: nextStatus }
        });

        if (!response.ok) {
            throw new Error(await errorFrom(response, 'Could not update the lobby'));
        }
        // show new status
        await loadLobbyDetails();
        await loadLobbyMembers();
    } catch (error) {
        console.error('Failed to update lobby', error);
        alert(error.message || 'Could not update the lobby.');
    }
}

function restaurantCard(option) {
    const { restaurant, adder } = option;
    const isAddedByCurrentUser = currentUser && adder && currentUser.id === adder.id;
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
        ? `<img src="${escapeHtml(getImageUrl(restaurant.photo_url))}" alt="${escapeHtml(restaurant.name)}"/>`
        : NO_PHOTO_HTML;
    const openNow = restaurant.is_open !== null && restaurant.is_open !== undefined
        ? `<div class="is-open ${restaurant.is_open ? 'open' : 'closed'}">
               ${restaurant.is_open ? '✓ Open Now' : '✗ Closed'}
           </div>`
        : '';
    const cuisine = restaurant.primary_type
        ? `<div class="cuisine-type" style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">🍽️ ${escapeHtml(restaurant.primary_type)}</div>`
        : '';

    const isSaved = window.savedPlaceIds && window.savedPlaceIds.has(restaurant.api_place_id);

    const votesForThis = currentVotes.filter(v => v.restaurant_id === restaurant.id);
    const hasVotedForThis = votesForThis.some(v => currentUser && v.user_id === currentUser.id);
    const showVotes = currentLobby.status === 'voting' || currentLobby.status === 'closed';
    const voteBadge = showVotes
        ? `<div style="margin-top: 5px; font-weight: bold; color: #ff6347;">Votes: ${votesForThis.length}</div>`
        : '';
        
    const voteBtnHtml = showVotes && currentLobby.status !== 'closed'
        ? `<button type="button" class="btn ${hasVotedForThis ? 'btn-secondary' : 'btn-primary'}" data-action="vote" data-restaurant-id="${restaurant.id}">${hasVotedForThis ? 'Voted ✓' : 'Vote'}</button>`
        : '';

    return `
        <div class="restaurant-card" style="position: relative;">
            ${isAddedByCurrentUser && currentLobby.status === 'active' ? `<button type="button" data-action="remove" data-restaurant-id="${restaurant.id}" title="Remove from Lobby" style="position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 50%; background: white; border: 1px solid #ddd; color: #dc3545; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10; padding: 0; line-height: 1;">&times;</button>` : ''}
            <div class="restaurant-image">${image}</div>
            <div class="restaurant-info">
                <div class="restaurant-name">${escapeHtml(restaurant.name)}</div>
                ${cuisine}
                <div class="restaurant-meta">${rating} ${price}</div>
                ${openNow}
                <div class="restaurant-address">${escapeHtml(restaurant.address || '')}</div>
                ${voteBadge}
                <div class="action-buttons-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    <div class="action-buttons" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0;">
                        ${voteBtnHtml}
                        <button type="button" class="btn btn-details" data-action="details" data-place-id="${escapeHtml(restaurant.api_place_id)}">Details</button>
                        <button type="button" class="btn btn-save ${isSaved ? 'saved' : ''}" data-action="save-lobby" data-place-id="${escapeHtml(restaurant.api_place_id)}" ${isSaved ? 'disabled' : ''}>${isSaved ? '✓ Saved' : '+ Save'}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentOptions = [];

function renderRestaurants(options) {
    if (options) currentOptions = options;
    const container = document.getElementById('lobby-restaurants-list');
    setScrollable(container, currentOptions.length);

    if (currentOptions.length === 0) {
        container.innerHTML = placeholder(
            'No restaurants have been added yet. Use the "Add from Search" button!',
            '#777'
        );
        return;
    }

    container.innerHTML = currentOptions.map(restaurantCard).join('');

    // Swap in the placeholder if a cached photo URL has gone stale. Done here
    // rather than with an inline onerror so the fallback markup doesn't have to
    // survive being escaped into an HTML attribute.
    container.querySelectorAll('.restaurant-image img').forEach((img) => {
        img.addEventListener('error', () => {
            img.parentElement.innerHTML = NO_PHOTO_HTML;
        });
    });
}

function messageHtml(message) {
    const isOwn = currentUser && message.user_id === currentUser.id;
    const author = message.user ? message.user.username : 'Unknown';
    const time = new Date(message.sent_at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    });

    // The id is on the element so a live broadcast can tell whether the message
    // it just received is already on screen.
    return `
        <div class="chat-message ${isOwn ? 'own-message' : ''}" data-message-id="${escapeHtml(message.id)}">
            <div class="chat-message-meta">
                <span class="chat-author">@${escapeHtml(author)}</span>
                <span class="chat-time">${escapeHtml(time)}</span>
            </div>
            <div class="chat-bubble">${escapeHtml(message.content || '')}</div>
        </div>
    `;
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');

    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-system-message">Be the first to send a message!</div>';
        return;
    }

    container.innerHTML = messages.map(messageHtml).join('');
    // Newest messages sit at the bottom, so land the user there.
    container.scrollTop = container.scrollHeight;
}

/** Adds a single message pushed over the socket to the bottom of the log. */
function appendMessage(message) {
    const container = document.getElementById('chat-messages');

    // A broadcast can race the initial fetch, and every reconnect refetches the
    // whole history - so drop anything that is already rendered.
    if (container.querySelector(`[data-message-id="${message.id}"]`)) return;

    // Clears "Be the first to send a message!" (and any error notice).
    container.querySelectorAll('.chat-system-message').forEach((el) => el.remove());

    // Only follow the conversation if the reader is already at the bottom.
    // Yanking someone away from the history they're scrolled up reading is
    // more annoying than a message they have to scroll down for.
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    container.insertAdjacentHTML('beforeend', messageHtml(message));
    if (isAtBottom) container.scrollTop = container.scrollHeight;
}

// ==========================================
// LIVE UPDATES (Socket.IO)
// ==========================================

function setChatStatus(state, text) {
    const badge = document.getElementById('chat-status');
    badge.className = `chat-status chat-status-${state}`;
    badge.textContent = text;
}

/**
 * The Socket.IO client is served by the API itself, so the host lives in
 * API_BASE_URL only - no second URL hardcoded into the markup to forget when
 * this gets deployed.
 */
function loadSocketIoClient() {
    return new Promise((resolve, reject) => {
        if (window.io) return resolve();
        const script = document.createElement('script');
        script.src = `${API_BASE_URL}/socket.io/socket.io.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load the live chat client.'));
        document.head.appendChild(script);
    });
}

async function connectLive() {
    try {
        await loadSocketIoClient();
    } catch (error) {
        // Chat still works over REST, it just won't update on its own.
        console.error(error);
        setChatStatus('offline', 'Offline');
        return;
    }

    // The handshake authenticates with the same HttpOnly JWT cookie the REST
    // calls use, which is why credentials have to be sent with it.
    socket = io(API_BASE_URL, { withCredentials: true });

    socket.on('connect', () => {
        socket.emit('lobby:join', currentLobbyId, (response) => {
            if (!response?.ok) {
                console.error('Could not join the lobby chat room:', response?.error);
                setChatStatus('offline', 'Offline');
                return;
            }
            lobbyConnected = true;
            setChatStatus('online', 'Live');

            // Refetch on every connect, not just the first: this also covers
            // whatever was said - and whoever joined or readied up - while a
            // dropped connection was reconnecting.
            loadLobbyMessages();
            loadLobbyMembers();
        });
    });

    socket.on('chat:message', appendMessage);

    // The server sends the whole member list, so this is the same render the
    // initial fetch does - no need to reconcile a delta against the DOM.
    socket.on('lobby:members', renderMembers);

    socket.on('disconnect', () => {
        lobbyConnected = false;
        setChatStatus('connecting', 'Reconnecting...');
    });

    socket.on('connect_error', (error) => {
        lobbyConnected = false;
        console.error('Live chat connection failed:', error.message);
        setChatStatus('offline', 'Offline');
    });
}

/** Resolves once the server has stored the message, rejects with its reason. */
function sendOverSocket(content) {
    return new Promise((resolve, reject) => {
        socket
            .timeout(5000)
            .emit('chat:send', { lobbyId: currentLobbyId, content }, (timeoutError, response) => {
                if (timeoutError) return reject(new Error('The server did not respond. Please try again.'));
                if (!response?.ok) return reject(new Error(response?.error || 'Failed to send message'));
                resolve();
            });
    });
}

async function sendMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    // Clear straight away so the box feels responsive; put it back if the send fails.
    input.value = '';

    try {
        if (lobbyConnected) {
            // The server echoes the message back to the whole room, this tab
            // included, so there's nothing to render here.
            await sendOverSocket(content);
        } else {
            // No live socket - post it the old way so chat still works when
            // WebSockets are blocked or the connection is still coming up.
            const response = await apiFetch(`/api/lobbies/${currentLobbyId}/messages`, {
                method: 'POST',
                body: { content }
            });
            if (!response.ok) throw new Error(await errorFrom(response, 'Failed to send message'));
            await loadLobbyMessages();
        }
    } catch (error) {
        console.error(error);
        input.value = content;
        alert(error.message || 'Could not send your message. Please try again.');
    }
}

// ==========================================
// ADD RESTAURANTS (SEARCH & SAVED)
// ==========================================

// Toggle Panels
document.getElementById('show-lobby-search-btn')?.addEventListener('click', () => {
    document.getElementById('lobby-add-container').style.display = 'block';
    document.getElementById('lobby-search-ui').style.display = 'block';
    document.getElementById('lobby-saved-ui').style.display = 'none';
});

document.getElementById('show-lobby-saved-btn')?.addEventListener('click', async () => {
    document.getElementById('lobby-add-container').style.display = 'block';
    document.getElementById('lobby-search-ui').style.display = 'none';
    document.getElementById('lobby-saved-ui').style.display = 'block';
    await loadLobbySavedRestaurants();
});

document.getElementById('close-add-container')?.addEventListener('click', () => {
    document.getElementById('lobby-add-container').style.display = 'none';
});

// Search API Call
document.getElementById('lobby-search-submit')?.addEventListener('click', async () => {
    const query = document.getElementById('lobby-search-input').value.trim();
    if (!query) return;

    const container = document.getElementById('lobby-search-results');
    container.innerHTML = '<div class="chat-system-message">Searching...</div>';

    try {
        const response = await apiFetch(`/api/restaurants/search/text?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        const results = await response.json();

        container.innerHTML = results.length === 0
            ? '<div class="chat-system-message">No results found.</div>'
            : results.map(r => renderAddCard(r)).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="chat-system-message" style="color:red;">Error searching.</div>';
    }
});

// Saved API Call
async function loadLobbySavedRestaurants() {
    const container = document.getElementById('lobby-saved-results');
    container.innerHTML = '<div class="chat-system-message">Loading saved restaurants...</div>';
    try {
        const response = await apiFetch('/api/restaurants/saved');
        if (!response.ok) throw new Error('Failed to load saved restaurants');
        const saved = await response.json();

        container.innerHTML = saved.length === 0
            ? '<div class="chat-system-message">No saved restaurants yet.</div>'
            : saved.map(r => renderAddCard(r)).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="chat-system-message" style="color:red;">Error loading saved restaurants.</div>';
    }
}

// Generate the Card HTML for Adding
function renderAddCard(restaurant) {
    const placeId = escapeHtml(restaurant.api_place_id);
    const image = restaurant.photo_url
        ? `<img src="${escapeHtml(getImageUrl(restaurant.photo_url))}" alt="${escapeHtml(restaurant.name)}"/>`
        : NO_PHOTO_HTML;

    const rating = restaurant.rating ? `<span style="font-size: 0.8rem; color: #666;">★ ${parseFloat(restaurant.rating).toFixed(1)}</span>` : '';
    const cuisine = restaurant.primary_type ? `<span style="font-size: 0.8rem; color: #666; margin-left: 5px;">🍽️ ${escapeHtml(restaurant.primary_type)}</span>` : '';

    return `
        <div class="restaurant-card">
            <div class="restaurant-image" style="height: 120px;">${image}</div>
            <div class="restaurant-info">
                <div class="restaurant-name" style="font-size: 1rem;">${escapeHtml(restaurant.name)}</div>
                <div style="margin-bottom: 4px;">${rating}${cuisine}</div>
                <div class="restaurant-address" style="font-size: 0.8rem;">${escapeHtml(restaurant.address || '')}</div>
                <div class="action-buttons">
                    <button type="button" class="btn btn-primary" data-action="add-to-lobby" data-place-id="${placeId}">Add to Lobby</button>
                </div>
            </div>
        </div>
    `;
}

// Handle "Add to Lobby" clicks inside the container
document.getElementById('lobby-add-container')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="add-to-lobby"]');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const response = await apiFetch(`/api/lobbies/${currentLobbyId}/restaurants`, {
            method: 'POST',
            body: { api_place_id: btn.dataset.placeId }
        });

        if (!response.ok) {
            throw new Error(await errorFrom(response, 'Failed to add restaurant'));
        }

        btn.textContent = 'Added!';
        btn.classList.replace('btn-primary', 'btn-secondary');

        await loadLobbyRestaurants();
    } catch (error) {
        console.error(error);
        alert(error.message);
        btn.disabled = false;
        btn.textContent = 'Add to Lobby';
    }
});

// ==========================================
// SETUP
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    window.savedPlaceIds = new Set();
    try {
        const response = await apiFetch('/api/restaurants/saved');
        if (response.ok) {
            const savedList = await response.json();
            savedList.forEach(r => window.savedPlaceIds.add(r.api_place_id));
        }
    } catch (e) {
        console.error('Failed to sync saved restaurants', e);
    }

    currentLobbyId = new URLSearchParams(window.location.search).get('id');

    if (!currentLobbyId) {
        window.location.replace('/index.html');
        return;
    }

    document.getElementById('chat-form').addEventListener('submit', sendMessage);

    // Handle Vote & Remove actions
    document.getElementById('lobby-restaurants-list').addEventListener('click', async (event) => {
        const voteBtn = event.target.closest('button[data-action="vote"]');
        if (voteBtn) {
            const restaurantId = voteBtn.dataset.restaurantId;
            voteBtn.disabled = true;
            voteBtn.textContent = 'Voting...';
            try {
                const response = await apiFetch(`/api/lobbies/${currentLobbyId}/votes`, {
                    method: 'POST',
                    body: { restaurantId }
                });
                if (!response.ok) {
                    throw new Error(await errorFrom(response, 'Failed to cast vote'));
                }
                // Reload votes to update UI
                await loadLobbyVotes();
                renderRestaurants(); // update cards
            } catch (error) {
                console.error(error);
                alert(error.message);
                voteBtn.disabled = false;
                voteBtn.textContent = 'Vote';
            }
        }

        const removeBtn = event.target.closest('button[data-action="remove"]');
        if (removeBtn) {
            const restaurantId = removeBtn.dataset.restaurantId;
            const card = removeBtn.closest('.restaurant-card');
            
            // Optimistic UI update: instantly hide/fade the card without alerting
            if (card) {
                card.style.transition = 'opacity 0.2s ease-out';
                card.style.opacity = '0.3';
                removeBtn.disabled = true;
            }

            try {
                const response = await apiFetch(`/api/lobbies/${currentLobbyId}/restaurants/${restaurantId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(await errorFrom(response, 'Failed to remove restaurant'));
                }

                await loadLobbyRestaurants();
            } catch (error) {
                console.error(error);
                // Revert optimistic UI on failure
                if (card) {
                    card.style.opacity = '1';
                    removeBtn.disabled = false;
                }
            }
        }

        const detailsBtn = event.target.closest('button[data-action="details"]');
        if (detailsBtn) {
            const { openDetailsModal } = await import('./modal.js');
            openDetailsModal(detailsBtn.dataset.placeId);
        }

        const saveBtn = event.target.closest('button[data-action="save-lobby"]');
        if (saveBtn) {
            // Need to fetch full place details from current list to save it to DB
            const placeId = saveBtn.dataset.placeId;
            saveBtn.textContent = '✓ Saved';
            saveBtn.disabled = true;
            saveBtn.classList.add('saved');

            try {
                const detRes = await apiFetch(`/api/restaurants/details/${placeId}`);
                if (!detRes.ok) throw new Error('Failed to fetch details for saving');
                const restaurant = await detRes.json();

                const response = await apiFetch('/api/restaurants/save', {
                    method: 'POST',
                    body: restaurant
                });
                if (!response.ok) {
                    const errText = await errorFrom(response, 'Failed to save restaurant');
                    if (errText.includes('already')) {
                        // Already saved, keep button in Saved state silently
                    } else {
                        throw new Error(errText);
                    }
                } else {
                    window.savedPlaceIds.add(placeId);
                }

            } catch (error) {
                console.error(error);
                // The user explicitly requested NO alerts and for the button to remain disabled + Saved
                // so we silently swallow the UI revert.
            }
        }
    });

    // Who the user is, then the lobby itself - the member list needs both to
    // work out which member is the host.
    await loadProfile();
    await loadLobbyDetails();

    if (currentLobby) {
        await Promise.all([
            loadLobbyMembers(),
            loadLobbyMessages(),
            loadLobbyVotes()
        ]);
        
        await loadLobbyRestaurants();

        // Only after the lobby loaded - a non-member would just be rejected by
        // the room join anyway, and they've already been bounced by now.
        connectLive();
    }
});