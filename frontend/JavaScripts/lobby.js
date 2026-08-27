/* global io */
// Lobby page: details, members, shortlisted restaurants and chat for one lobby.
// Depends on api.js (API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin).
import {
    API_BASE_URL, apiFetch, errorFrom, escapeHtml, redirectToLogin
, getImageUrl } from './api.js';
import { confirmModal, showToast } from './ui-feedback.js';
import { openDetailsModal } from './modal.js';

let currentLobby = null;
let currentUser = null;
let currentLobbyId = null;

// The last member list we rendered. A phase change has to redraw the member
// panel (the ready button's label depends on the phase) but arrives without a
// member list of its own, so keep the last one around.
let currentMembers = [];

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

/**
 * Fetches the lobby and hands it to applyLobbyState.
 *
 * `initial` marks the load the page can't open without. Every other call is a
 * refresh - after a ready toggle, and on every socket reconnect - and those
 * must not bounce the user to the dashboard just because one request failed.
 * A dropped connection is exactly when this refetch is most likely to fail and
 * exactly when throwing the user out would be least forgivable; a 403 or 404
 * is different, because that says they genuinely can't be here any more.
 */
async function loadLobbyDetails({ initial = false } = {}) {
    let response;

    try {
        response = await apiFetch(`/api/lobbies/${currentLobbyId}`);
    } catch (error) {
        console.error('Failed to reach the lobby endpoint', error);
        if (initial) bounceToDashboard('Failed to load lobby.');
        return;
    }

    // Non-members get a 403 and people with a stale link get a 404.
    if (response.status === 403 || response.status === 404) {
        return bounceToDashboard(await errorFrom(response, 'You are not a member of this lobby.'));
    }

    if (!response.ok) {
        console.error('Failed to load lobby details:', response.status);
        if (initial) bounceToDashboard('Failed to load lobby.');
        return;
    }

    try {
        applyLobbyState(await response.json());
    } catch (error) {
        console.error('Malformed lobby payload', error);
        if (initial) bounceToDashboard('Failed to load lobby.');
    }
}

function bounceToDashboard(message) {
    showToast(message, 'error');
    setTimeout(() => {
        window.location.replace('/index.html');
    }, 1200);
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
        if (currentOptions.length > 0) renderRestaurants();
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// LOBBY STATE
// ==========================================

const PHASE_ANNOUNCEMENTS = {
    voting: ['Everyone is ready — voting has started!', 'success'],
    closed: ['The lobby is closed. The votes are in!', 'success'],
    active: ['The lobby is open for suggestions again.', 'info'],
};

/**
 * Adopts a lobby record — from the initial fetch or pushed over the socket —
 * and redraws everything the phase controls.
 *
 * The status field gates the header button, the ready button's wording, the
 * vote buttons and the winner banner, so a change to it has to fan out to all
 * of them. Routing both the fetch and the broadcast through here means a member
 * who wasn't the one clicking sees exactly what the clicker sees.
 */
function applyLobbyState(lobby) {
    if (!lobby) return;

    const previousStatus = currentLobby ? currentLobby.status : null;
    currentLobby = lobby;

    renderLobbyHeader(lobby);
    syncPhaseControls();

    // GET /api/lobbies/:id and the lobby:state broadcast both embed the members;
    // fall back to the last list we saw in case that ever changes.
    renderMembers(lobby.members || currentMembers);
    if (currentOptions.length > 0) renderRestaurants();

    // Only announce a real transition, and never the very first render — a
    // reload of an already-closed lobby shouldn't toast about it.
    if (previousStatus && lobby.status !== previousStatus) {
        const announcement = PHASE_ANNOUNCEMENTS[lobby.status];
        if (announcement) showToast(announcement[0], announcement[1]);
    }
}

/**
 * Suggestions are only accepted while the lobby is active — the server rejects
 * them outright afterwards — so hide the add controls once voting starts
 * rather than letting people click into a 403.
 */
function syncPhaseControls() {
    const isActive = currentLobby && currentLobby.status === 'active';

    const sectionControls = document.querySelector('.section-controls');
    if (sectionControls) sectionControls.style.display = isActive ? 'flex' : 'none';

    // Someone can be mid-search when the host starts voting; close the panel
    // out from under them instead of leaving dead "Add to Lobby" buttons up.
    if (!isActive) {
        const addContainer = document.getElementById('lobby-add-container');
        if (addContainer) addContainer.style.display = 'none';
    }
}

// ==========================================
// RENDERING
// ==========================================

function renderLobbyHeader(lobby) {
    document.getElementById('lobby-name').textContent = lobby.name || 'Untitled Lobby';
    const isCreator = currentUser && lobby.creator && currentUser.id === lobby.creator.id;
    const inviteCode = lobby.invite_code || '';

    document.getElementById('lobby-meta-info').innerHTML = `
        <div class="meta-item">Status: <strong>${escapeHtml(lobby.status)}</strong></div>
        <div class="meta-item meta-item-invite">
            <span>Invite Code:</span>
            <code class="invite-code-pill" id="invite-code-display">${escapeHtml(inviteCode || '—')}</code>
            ${inviteCode ? `
            <button type="button" id="copy-invite-btn" class="copy-invite-btn" aria-label="Copy lobby invite link and code" title="Copy invite link">
                <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span id="copy-btn-label">Copy Link</span>
            </button>
            ` : ''}
        </div>
        <div class="meta-item">Created by: <strong>@${escapeHtml(lobby.creator.username)}</strong></div>
    `;

    const copyBtn = document.getElementById('copy-invite-btn');
    if (copyBtn && inviteCode) {
        copyBtn.addEventListener('click', async () => {
            const joinUrl = `${window.location.origin}/index.html?join=${encodeURIComponent(inviteCode)}`;
            const textToCopy = joinUrl;

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(textToCopy);
                } else {
                    const tempInput = document.createElement('textarea');
                    tempInput.value = textToCopy;
                    tempInput.style.position = 'fixed';
                    tempInput.style.opacity = '0';
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                }

                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                `;

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `
                        <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy Link</span>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy', err);
            }
        });
    }
}

function renderMembers(members) {
    currentMembers = members;
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
    const actionContainer = document.getElementById('lobby-action-container');
    if (!actionContainer) return;

    if (currentLobby.status === 'closed') {
        actionContainer.innerHTML = `<button type="button" class="btn" style="color: #dc3545; border-color: #dc3545; background-color: #fff;" disabled>Lobby Closed</button>`;
        return;
    }

    const totalMembers = members.length;
    const readyCount = members.filter((m) => m.ready).length;
    
    const actionName = currentLobby.status === 'active' ? 'Start Voting' : 'Close Lobby';
    const currentUserMember = members.find(m => currentUser && m.user.id === currentUser.id);
    const myReady = currentUserMember ? currentUserMember.ready : false;

    const btnText = myReady ? `Unready (${readyCount}/${totalMembers} ready)` : `${actionName} (${readyCount}/${totalMembers} ready)`;
    const btnClass = myReady ? 'btn-secondary' : 'btn-warning';

    actionContainer.innerHTML = `<button type="button" class="btn ${btnClass}" data-action="toggle-ready" data-ready="${myReady}">${btnText}</button>`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action="toggle-ready"]');
        if (btn) {
            const currentReady = btn.dataset.ready === 'true';
            await toggleMyReady(!currentReady);
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
        // The server broadcasts to the room, this tab included, but refetch
        // anyway so the badge still flips when the socket is down. Details and
        // not just members: being the last one to ready up tips the whole lobby
        // into the voting phase.
        await loadLobbyDetails();
        await loadLobbyMembers();
    } catch (error) {
        console.error('Failed to update ready state', error);
        showToast(error.message || 'Could not update ready state.', 'error');
    }
}

const CROWN_SVG = `<svg class="winner-crown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;"><polygon points="2 4 5 16 19 16 22 4 16 11 12 4 8 11 2 4"></polygon><line x1="5" y1="20" x2="19" y2="20"></line></svg>`;

function restaurantCard(option, isWinner = false) {
    const { restaurant, adder } = option;
    const isAddedByCurrentUser = currentUser && adder && currentUser.id === adder.id;
    const isClosed = currentLobby && currentLobby.status === 'closed';

    const rating = restaurant.rating
        ? `<div class="rating-badge" style="font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; color: #444;">
               <span class="stars"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>
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
               ${restaurant.is_open ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Open Now' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Closed'}
           </div>`
        : '';
    const cuisine = restaurant.primary_type
        ? `<div class="cuisine-type" style="font-size: 0.85rem; color: #666; margin-bottom: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> ${escapeHtml(restaurant.primary_type)}</div>`
        : '';

    const isSaved = window.savedPlaceIds && window.savedPlaceIds.has(restaurant.api_place_id);

    const votesForThis = currentVotes.filter(v => v.restaurant_id === restaurant.id);
    const hasVotedForThis = votesForThis.some(v => currentUser && v.user_id === currentUser.id);
    const showVotes = currentLobby.status === 'voting' || isClosed;
    const voteBadge = showVotes
        ? `<div style="margin-top: 5px; font-weight: bold; color: #ff6347;">Votes: ${votesForThis.length}</div>`
        : '';
        
    const voteBtnHtml = showVotes && !isClosed
        ? `<button type="button" class="btn ${hasVotedForThis ? 'btn-secondary' : 'btn-primary'}" data-action="vote" data-restaurant-id="${restaurant.id}">${hasVotedForThis ? 'Voted <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : 'Vote'}</button>`
        : '';

    const winnerBadgeHtml = (isClosed && isWinner)
        ? `<div class="winner-crown-badge">${CROWN_SVG}<span>Tonight's Choice • Winner</span></div>`
        : '';

    const cardClasses = [
        'restaurant-card',
        (isClosed && isWinner) ? 'winning-restaurant-card' : '',
        (isClosed && !isWinner) ? 'closed-non-winner' : ''
    ].filter(Boolean).join(' ');

    return `
        <div class="${cardClasses}" style="position: relative;">
            ${winnerBadgeHtml}
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
                        <button type="button" class="btn ${isWinner && isClosed ? 'btn-primary' : 'btn-details'}" data-action="details" data-place-id="${escapeHtml(restaurant.api_place_id)}">${isWinner && isClosed ? 'View Details & Hours' : 'Details'}</button>
                        <button type="button" class="btn btn-save ${isSaved ? 'saved' : ''}" data-action="save-lobby" data-place-id="${escapeHtml(restaurant.api_place_id)}" ${isSaved ? 'disabled' : ''}>${isSaved ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Saved' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Save'}</button>
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
    const spotlightContainer = document.getElementById('lobby-winner-spotlight');
    setScrollable(container, currentOptions.length);

    if (currentOptions.length === 0) {
        if (spotlightContainer) spotlightContainer.innerHTML = '';
        container.innerHTML = placeholder(
            'No restaurants have been added yet. Use the "Add from Search" button!',
            '#777'
        );
        return;
    }

    const isClosed = currentLobby && currentLobby.status === 'closed';
    let winningOption = null;
    let maxVotes = -1;

    if (isClosed) {
        // Calculate the highest voted option
        currentOptions.forEach((opt) => {
            const count = currentVotes.filter(v => v.restaurant_id === opt.restaurant.id).length;
            if (count > maxVotes) {
                maxVotes = count;
                winningOption = opt;
            }
        });

        // Render spotlight banner
        if (spotlightContainer && winningOption) {
            const r = winningOption.restaurant;
            const voteCount = currentVotes.filter(v => v.restaurant_id === r.id).length;
            spotlightContainer.innerHTML = `
                <div class="winner-spotlight-banner">
                    <div class="winner-spotlight-left">
                        <div class="winner-spotlight-icon-wrap">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="2 4 5 16 19 16 22 4 16 11 12 4 8 11 2 4"></polygon>
                                <line x1="5" y1="20" x2="19" y2="20"></line>
                            </svg>
                        </div>
                        <div class="winner-spotlight-text">
                            <h4>Tonight's Pick: ${escapeHtml(r.name)}</h4>
                            <p>The votes are in! With <strong>${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}</strong>, this spot won the group vote.</p>
                        </div>
                    </div>
                    <div class="winner-spotlight-action">
                        <button type="button" class="btn btn-primary" data-action="details" data-place-id="${escapeHtml(r.api_place_id)}">View Details & Hours</button>
                    </div>
                </div>
            `;
        }
    } else if (spotlightContainer) {
        spotlightContainer.innerHTML = '';
    }

    // If closed, sort options so winner is first
    const displayOptions = [...currentOptions];
    if (isClosed && winningOption) {
        displayOptions.sort((a, b) => {
            if (a.restaurant.id === winningOption.restaurant.id) return -1;
            if (b.restaurant.id === winningOption.restaurant.id) return 1;
            const countA = currentVotes.filter(v => v.restaurant_id === a.restaurant.id).length;
            const countB = currentVotes.filter(v => v.restaurant_id === b.restaurant.id).length;
            return countB - countA;
        });
    }

    // Votes now stream in, so this list redraws while people are reading it.
    // Rebuilding the HTML drops the scroll position, which would yank a long
    // shortlist back to the top every time somebody else clicked Vote.
    const previousScroll = container.scrollTop;

    container.innerHTML = displayOptions.map(opt => {
        const isWinner = isClosed && winningOption && opt.restaurant.id === winningOption.restaurant.id;
        return restaurantCard(opt, isWinner);
    }).join('');

    container.scrollTop = previousScroll;

    // Handle spotlight button click delegation
    if (spotlightContainer) {
        const spotlightBtn = spotlightContainer.querySelector('button[data-action="details"]');
        if (spotlightBtn) {
            spotlightBtn.addEventListener('click', () => {
                openDetailsModal(spotlightBtn.dataset.placeId);
            });
        }
    }

    // Swap in the placeholder if a cached photo URL has gone stale.
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
            // everything that happened - messages, joins, readies, added
            // restaurants, votes, the phase itself - while a dropped
            // connection was reconnecting.
            resyncLobby();
        });
    });

    socket.on('chat:message', appendMessage);

    // Every one of these carries a full snapshot rather than a delta, so each
    // is just the render the initial fetch does - nothing to reconcile against
    // the DOM, and a missed event fixes itself on the next one.
    socket.on('lobby:members', renderMembers);
    socket.on('lobby:state', applyLobbyState);
    socket.on('lobby:options', renderRestaurants);

    socket.on('lobby:votes', (votes) => {
        currentVotes = votes;
        renderRestaurants();
    });

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

/**
 * Pulls the whole lobby down again.
 *
 * Runs on first connect and on every reconnect. The broadcasts keep a live tab
 * current, but a tab that was disconnected missed them outright, so the only
 * safe move on reconnect is to re-read everything. Details first: the member
 * and restaurant renders both read currentLobby.status.
 */
async function resyncLobby() {
    await loadLobbyDetails();
    await Promise.all([
        loadLobbyMembers(),
        loadLobbyMessages(),
        loadLobbyVotes(),
        loadLobbyRestaurants(),
    ]);
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
        showToast(error.message || 'Could not send your message. Please try again.', 'error');
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

    const rating = restaurant.rating ? `<span style="font-size: 0.8rem; color: #666;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${parseFloat(restaurant.rating).toFixed(1)}</span>` : '';
    const cuisine = restaurant.primary_type ? `<span style="font-size: 0.8rem; color: #666; margin-left: 5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> ${escapeHtml(restaurant.primary_type)}</span>` : '';

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
        showToast('Restaurant added to lobby!', 'success');

        await loadLobbyRestaurants();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to add restaurant to lobby.', 'error');
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
                showToast('Vote recorded!', 'success');
                // Reload votes to update UI
                await loadLobbyVotes();
                renderRestaurants(); // update cards
            } catch (error) {
                console.error(error);
                showToast(error.message || 'Failed to cast vote.', 'error');
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
            saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Saved';
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
    await loadLobbyDetails({ initial: true });

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