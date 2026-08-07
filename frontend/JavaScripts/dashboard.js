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
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/profile/saved-restaurants`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const saved = await response.json();
                const list = document.getElementById('saved-list');

                if (saved.length === 0) {
                    list.innerHTML = '<li>No saved restaurants yet.</li>';
                    return;
                }

                list.innerHTML = saved.map(item => `
                    <li>
                        <strong>${item.restaurant.name}</strong> 
                        <button onclick="removeRestaurant(${item.restaurant_id})">Remove</button>
                    </li>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load saved restaurants', error);
        }
    }

    // 3. Load Lobbies
    async function loadLobbies() {
        const list = document.getElementById('lobby-list');

        try {
            const response = await fetch(`${API_BASE_URL}/api/lobbies`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) return;

            const lobbies = await response.json();
            list.replaceChildren();

            if (lobbies.length === 0) {
                const empty = document.createElement('li');
                empty.textContent = 'You have not joined any lobbies.';
                list.appendChild(empty);
                return;
            }

            // Built with DOM APIs rather than innerHTML — lobby names come from other users.
            for (const lobby of lobbies) {
                const item = document.createElement('li');

                const link = document.createElement('a');
                link.href = `/lobby.html?id=${lobby.id}`;
                link.textContent = lobby.name || 'Untitled Lobby';
                item.appendChild(link);

                const meta = document.createElement('span');
                meta.textContent = ` — ${lobby.status} · ${lobby._count.members} member(s)`;
                item.appendChild(meta);

                list.appendChild(item);
            }
        } catch (error) {
            console.error('Failed to load lobbies', error);
        }
    }

    // 4. Create / Join a Lobby
    const lobbyError = document.getElementById('lobby-error');

    async function errorFrom(response, fallback) {
        try {
            const body = await response.json();
            return body.error || body.message || fallback;
        } catch {
            return fallback;
        }
    }

    document.getElementById('create-lobby-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        lobbyError.textContent = '';

        const nameInput = document.getElementById('create-lobby-name');
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/lobbies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
                credentials: 'include'
            });

            if (!response.ok) {
                lobbyError.textContent = await errorFrom(response, 'Could not create the lobby.');
                return;
            }

            // Go straight to the new lobby so the host can grab the invite code.
            const lobby = await response.json();
            window.location.href = `/lobby.html?id=${lobby.id}`;
        } catch (error) {
            lobbyError.textContent = 'Server error. Please try again.';
        }
    });

    document.getElementById('join-lobby-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        lobbyError.textContent = '';

        const codeInput = document.getElementById('join-lobby-code');
        const invite_code = codeInput.value.trim();
        if (!invite_code) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/lobbies/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code }),
                credentials: 'include'
            });

            if (!response.ok) {
                lobbyError.textContent = await errorFrom(response, 'Could not join the lobby.');
                return;
            }

            const lobby = await response.json();
            window.location.href = `/lobby.html?id=${lobby.id}`;
        } catch (error) {
            lobbyError.textContent = 'Server error. Please try again.';
        }
    });

    // 5. Handle Logout
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
        const response = await fetch(`${API_BASE_URL}/api/users/profile/saved-restaurants/${restaurantId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            // Reload the list to show the update
            location.reload();
        }
    } catch (error) {
        console.error('Failed to remove restaurant', error);
    }
};