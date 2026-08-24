import { apiFetch, escapeHtml , getImageUrl } from './api.js';

// Inject modal HTML into the body once
const modalHTML = `
<div id="restaurant-details-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-restaurant-name" aria-hidden="true" style="display: none;">
    <div class="modal-content">
        <button class="modal-close" aria-label="Close details modal">&times;</button>
        <div id="modal-body">
            <!-- Content will be injected here -->
        </div>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

const modal = document.getElementById('restaurant-details-modal');
const modalBody = document.getElementById('modal-body');
const closeBtn = modal.querySelector('.modal-close');

let previouslyFocusedElement = null;

export function closeDetailsModal() {
    if (!modal || modal.style.display === 'none') return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        previouslyFocusedElement.focus();
    }
}

closeBtn.addEventListener('click', closeDetailsModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeDetailsModal();
    }
});

// Keyboard accessibility: Escape to close and Tab focus trapping
window.addEventListener('keydown', (e) => {
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailsModal();
        return;
    }

    if (e.key === 'Tab') {
        const focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modal.querySelectorAll(focusableSelectors));
        
        if (focusables.length === 0) {
            e.preventDefault();
            return;
        }

        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    }
});

function checkIfOpen(openingHoursArray) {
    if (!openingHoursArray || !Array.isArray(openingHoursArray) || openingHoursArray.length === 0) return null;
    
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todayStr = openingHoursArray.find(str => str.startsWith(dayName));
    
    if (!todayStr) return null;
    
    const hoursPart = todayStr.substring(todayStr.indexOf(':') + 1).trim();
    if (hoursPart === 'Closed') return false;
    if (hoursPart === 'Open 24 hours') return true;
    
    const ranges = hoursPart.split(',').map(s => s.trim());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const range of ranges) {
        // Google uses en-dash or hyphen
        const parts = range.split(/[\u2013\-]/).map(s => s.trim()); 
        if (parts.length !== 2) continue;
        
        const parseTime = (timeStr) => {
            const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
            if (!match) return -1;
            let hours = parseInt(match[1], 10);
            const mins = match[2] ? parseInt(match[2], 10) : 0;
            const isPM = match[3].toUpperCase() === 'PM';
            if (hours === 12 && !isPM) hours = 0;
            else if (hours < 12 && isPM) hours += 12;
            return hours * 60 + mins;
        };
        
        let startMins = parseTime(parts[0]);
        let endMins = parseTime(parts[1]);
        
        // Handle formats like "5:30 – 10:00 PM" where the first part omits AM/PM
        if (startMins !== -1 && endMins !== -1 && !parts[0].toLowerCase().includes('m') && parts[1].toLowerCase().includes('m')) {
            const isEndPM = parts[1].toLowerCase().includes('pm');
            if (isEndPM && startMins < 12 * 60 && startMins + 12 * 60 < endMins) {
                 startMins += 12 * 60;
            }
        }
        
        if (startMins !== -1 && endMins !== -1 && currentMinutes >= startMins && currentMinutes <= endMins) {
            return true;
        }
    }
    
    return false;
}

function buildDetailsHTML(details) {
    const photo = details.photo_url ? `<img src="${escapeHtml(getImageUrl(details.photo_url))}" alt="${escapeHtml(details.name)}" class="modal-hero-img">` : '';
    const starSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    const rating = details.rating ? `<div style="display:flex; align-items:center;">${starSvg} ${parseFloat(details.rating).toFixed(1)} (${details.user_rating_count || 0} reviews)</div>` : '';
    
    // Descriptive Price Level
    let priceText = '';
    if (details.price_level === 1) priceText = 'Inexpensive ($)';
    else if (details.price_level === 2) priceText = 'Moderate ($$)';
    else if (details.price_level === 3) priceText = 'Expensive ($$$)';
    else if (details.price_level === 4) priceText = 'Very Expensive ($$$$)';
    const price = priceText ? `<span class="price-level">${priceText}</span>` : '';
    
    const cuisine = details.primary_type ? `<span class="tag">${escapeHtml(details.primary_type)}</span>` : '';
    
    // Dynamic Open Status: Check Google's explicit boolean first, fallback to calculating it ourselves
    let isCurrentlyOpen = details.is_open;
    if (isCurrentlyOpen === null || isCurrentlyOpen === undefined) {
        isCurrentlyOpen = checkIfOpen(details.opening_hours);
    }
    const openStatus = isCurrentlyOpen !== null ? (isCurrentlyOpen ? '<span class="status open">Open Now</span>' : '<span class="status closed">Closed</span>') : '';

    
    let links = '';
    const phoneSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    const webSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    const mapSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    const searchSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    if (details.phone_number) links += `<a href="tel:${details.phone_number}" class="modal-link">${phoneSvg} Call</a>`;
    if (details.website_url) links += `<a href="${details.website_url}" target="_blank" class="modal-link">${webSvg} Website</a>`;
    if (details.google_maps_url) links += `<a href="${details.google_maps_url}" target="_blank" class="modal-link">${mapSvg} Directions</a>`;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(details.name + ' ' + (details.address || ''))}`;
    links += `<a href="${googleSearchUrl}" target="_blank" class="modal-link">${searchSvg} Search</a>`;

    let hoursHtml = '';
    if (details.opening_hours && Array.isArray(details.opening_hours) && details.opening_hours.length > 0) {
        const hoursList = details.opening_hours.map(day => `<li>${escapeHtml(day)}</li>`).join('');
        hoursHtml = `
            <div class="modal-section">
                <h3>Opening Hours</h3>
                <ul class="modal-hours">${hoursList}</ul>
            </div>
        `;
    }

    return `
        ${photo}
        <div class="modal-header">
            <h2 id="modal-restaurant-name">${escapeHtml(details.name)}</h2>
            <div class="modal-meta">${rating} ${rating && price ? '<span class="meta-separator">•</span>' : ''} ${price}</div>
            <div class="modal-tags">${cuisine} ${openStatus}</div>
        </div>
        <div class="modal-address">${escapeHtml(details.address || 'Address not available')}</div>
        ${hoursHtml}
        <div class="modal-links">
            ${links}
        </div>
    `;
}

export async function openDetailsModal(placeId) {
    previouslyFocusedElement = document.activeElement;
    modalBody.innerHTML = `<div class="spinner" style="margin: 40px auto; display: block;"></div>`;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus the close button initially
    if (closeBtn) closeBtn.focus();

    try {
        const response = await apiFetch(`/api/restaurants/details/${placeId}`);
        if (!response.ok) throw new Error(`Failed to load details: ${response.status}`);
        const details = await response.json();
        modalBody.innerHTML = buildDetailsHTML(details);
    } catch (error) {
        console.error(error);
        modalBody.innerHTML = `<div class="error-msg">Failed to load restaurant details.</div>`;
    }
}
