// Login / registration page.
// Depends on api.js (API_BASE_URL, apiFetch, errorFrom).

function showError(message, isSuccess = false) {
    const authError = document.getElementById('auth-error');
    authError.style.color = isSuccess ? 'green' : 'red';
    authError.textContent = message;
}

function showSection(name) {
    document.getElementById('login-section').style.display = name === 'login' ? 'block' : 'none';
    document.getElementById('register-section').style.display = name === 'register' ? 'block' : 'none';
    showError('');
}

// Someone arriving with a valid cookie doesn't need to log in again.
async function redirectIfSignedIn() {
    try {
        const response = await apiFetch('/api/users/profile');
        if (response.ok) {
            window.location.replace('/index.html'); // replace() so back doesn't return here
            return true;
        }
    } catch {
        // Server unreachable — just let them try to log in.
    }
    return false;
}

async function login(event) {
    event.preventDefault();

    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;

    // The endpoint accepts either an email or a username, so pick based on shape.
    const isEmail = identifier.includes('@');

    try {
        const response = await apiFetch('/api/users/login', {
            method: 'POST',
            body: {
                email: isEmail ? identifier : undefined,
                username: isEmail ? undefined : identifier,
                password
            }
        });

        if (!response.ok) {
            showError(await errorFrom(response, 'Login failed'));
            return;
        }

        window.location.replace('/index.html');
    } catch (error) {
        console.error('Login failed', error);
        showError('Server error. Please try again later.');
    }
}

async function register(event) {
    event.preventDefault();

    try {
        const response = await apiFetch('/api/users/register', {
            method: 'POST',
            body: {
                username: document.getElementById('register-username').value,
                email: document.getElementById('register-email').value,
                password: document.getElementById('register-password').value
            }
        });

        if (!response.ok) {
            showError(await errorFrom(response, 'Registration failed'));
            return;
        }

        showSection('login');
        showError('Registration successful! Please log in.', true);
    } catch (error) {
        console.error('Registration failed', error);
        showError('Server error. Please try again later.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (await redirectIfSignedIn()) return;

    document.getElementById('show-register').addEventListener('click', () => showSection('register'));
    document.getElementById('show-login').addEventListener('click', () => showSection('login'));
    document.getElementById('login-form').addEventListener('submit', login);
    document.getElementById('register-form').addEventListener('submit', register);
});
