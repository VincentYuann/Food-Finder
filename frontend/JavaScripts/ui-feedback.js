// ui-feedback.js: Accessible in-app toast notifications and confirmation dialogs
import { escapeHtml } from './api.js';

let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

/**
 * Show a sleek, non-blocking toast notification.
 * @param {string} message 
 * @param {'info' | 'success' | 'error'} type 
 * @param {number} durationMs 
 */
export function showToast(message, type = 'info', durationMs = 3500) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-pill toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="12" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
        <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 200);
    };

    closeBtn.addEventListener('click', dismiss);
    container.appendChild(toast);

    if (durationMs > 0) {
        setTimeout(dismiss, durationMs);
    }
}

/**
 * Show an accessible, styled in-app confirmation modal.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {string} [options.confirmClass]
 * @returns {Promise<boolean>}
 */
export function confirmModal({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'btn-primary'
} = {}) {
    return new Promise((resolve) => {
        const previousActiveElement = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay confirmation-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'confirm-modal-title');
        overlay.setAttribute('aria-describedby', 'confirm-modal-desc');

        overlay.innerHTML = `
            <div class="modal-content confirmation-modal-content">
                <div class="confirm-modal-header">
                    <h3 id="confirm-modal-title">${escapeHtml(title)}</h3>
                </div>
                <div class="confirm-modal-body">
                    <p id="confirm-modal-desc">${escapeHtml(message)}</p>
                </div>
                <div class="confirm-modal-actions">
                    <button type="button" class="btn btn-secondary" id="confirm-modal-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn ${escapeHtml(confirmClass)}" id="confirm-modal-submit">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const cancelBtn = overlay.querySelector('#confirm-modal-cancel');
        const submitBtn = overlay.querySelector('#confirm-modal-submit');

        const cleanup = (result) => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
            if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus();
            }
            resolve(result);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            } else if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === cancelBtn) {
                    e.preventDefault();
                    submitBtn.focus();
                } else if (!e.shiftKey && document.activeElement === submitBtn) {
                    e.preventDefault();
                    cancelBtn.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        cancelBtn.addEventListener('click', () => cleanup(false));
        submitBtn.addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });

        submitBtn.focus();
    });
}
