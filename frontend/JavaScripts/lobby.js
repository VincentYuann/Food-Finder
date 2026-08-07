// Change this manually to 'https://api.yourdomain.com' only when deploying to the cloud.
const API_BASE_URL = 'http://localhost:5000';

const lobbyId = new URLSearchParams(window.location.search).get('id');

const statusMessage = document.getElementById('lobby-status-message');
const lobbyContent = document.getElementById('lobby-content');
const actionError = document.getElementById('action-error');

let currentUserId = null;

function showStatus(text) {
    statusMessage.textContent = text;
    statusMessage.style.display = text ? 'block' : 'none';
}

function showError(text) {
    actionError.textContent = text;
}

// Reads the JSON error body an endpoint returned, falling back to a generic message.
async function errorFrom(response, fallback) {
    try {
        const body = await response.json();
        return body.error || body.message || fallback;
    } catch {
        return fallback;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!lobbyId) {
        showStatus('No lobby selected.');
        return;
    }

    // Identify the current user so we know whether to show creator controls.
    try {
        const profileRes = await fetch(`${API_BASE_URL}/api/users/profile`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!profileRes.ok) {
            window.location.replace('/login.html');
            return;
        }

        currentUserId = (await profileRes.json()).id;
    } catch (error) {
        showStatus('Could not reach the server.');
        return;
    }

    await loadLobby();
});

async function loadLobby() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        if (response.status === 403) {
            showStatus('You are not a member of this lobby.');
            return;
        }
        if (response.status === 404) {
            showStatus('That lobby no longer exists.');
            return;
        }
        if (!response.ok) {
            showStatus('Could not load this lobby.');
            return;
        }

        renderLobby(await response.json());
    } catch (error) {
        console.error('Failed to load lobby', error);
        showStatus('Could not reach the server.');
    }
}

function renderLobby(lobby) {
    const isCreator = lobby.created_by === currentUserId;

    // textContent throughout — lobby names and usernames come from other users.
    document.getElementById('lobby-name').textContent = lobby.name || 'Untitled Lobby';
    document.getElementById('lobby-state').textContent = lobby.status;
    document.getElementById('lobby-creator').textContent = `@${lobby.creator.username}`;
    document.getElementById('invite-code').textContent = lobby.invite_code || '—';
    document.getElementById('member-count').textContent = lobby.members.length;

    const list = document.getElementById('member-list');
    list.replaceChildren();

    for (const member of lobby.members) {
        const item = document.createElement('li');
        item.textContent = `@${member.user.username}`;

        if (member.user.id === lobby.created_by) {
            const tag = document.createElement('em');
            tag.textContent = ' (host)';
            item.appendChild(tag);
        }
        if (member.user.id === currentUserId) {
            const tag = document.createElement('em');
            tag.textContent = ' (you)';
            item.appendChild(tag);
        }

        // The host can remove anyone but themselves.
        if (isCreator && member.user.id !== lobby.created_by) {
            const kick = document.createElement('button');
            kick.textContent = 'Remove';
            kick.style.marginLeft = '10px';
            kick.addEventListener('click', () => removeMember(member.user.id, member.user.username));
            item.appendChild(kick);
        }

        list.appendChild(item);
    }

    document.getElementById('creator-controls').style.display = isCreator ? 'block' : 'none';
    document.getElementById('leave-lobby-btn').style.display = isCreator ? 'none' : 'inline-block';
    document.getElementById('rename-input').value = lobby.name || '';

    showStatus('');
    lobbyContent.style.display = 'block';
}

// --- Actions ---

document.getElementById('copy-code-btn').addEventListener('click', async () => {
    const code = document.getElementById('invite-code').textContent;
    const feedback = document.getElementById('copy-feedback');

    try {
        await navigator.clipboard.writeText(code);
        feedback.textContent = 'Copied!';
    } catch {
        // Clipboard access needs a secure context, which plain http://localhost may not give.
        feedback.textContent = `Copy it manually: ${code}`;
    }

    setTimeout(() => { feedback.textContent = ''; }, 2000);
});

document.getElementById('rename-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const name = document.getElementById('rename-input').value.trim();
    if (!name) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
            credentials: 'include'
        });

        if (!response.ok) {
            showError(await errorFrom(response, 'Could not rename the lobby.'));
            return;
        }

        await loadLobby();
    } catch (error) {
        showError('Server error. Please try again.');
    }
});

document.getElementById('delete-lobby-btn').addEventListener('click', async () => {
    if (!confirm('Delete this lobby for everyone? This cannot be undone.')) return;
    showError('');

    try {
        const response = await fetch(`${API_BASE_URL}/api/lobbies/${lobbyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            showError(await errorFrom(response, 'Could not delete the lobby.'));
            return;
        }

        window.location.replace('/index.html');
    } catch (error) {
        showError('Server error. Please try again.');
    }
});

document.getElementById('leave-lobby-btn').addEventListener('click', async () => {
    if (!confirm('Leave this lobby?')) return;
    showError('');

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/lobbies/${lobbyId}/members/${currentUserId}`,
            { method: 'DELETE', credentials: 'include' }
        );

        if (!response.ok) {
            showError(await errorFrom(response, 'Could not leave the lobby.'));
            return;
        }

        window.location.replace('/index.html');
    } catch (error) {
        showError('Server error. Please try again.');
    }
});

async function removeMember(userId, username) {
    if (!confirm(`Remove @${username} from this lobby?`)) return;
    showError('');

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/lobbies/${lobbyId}/members/${userId}`,
            { method: 'DELETE', credentials: 'include' }
        );

        if (!response.ok) {
            showError(await errorFrom(response, 'Could not remove that member.'));
            return;
        }

        await loadLobby();
    } catch (error) {
        showError('Server error. Please try again.');
    }
}
