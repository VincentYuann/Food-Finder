import { apiFetch, escapeHtml } from './api.js';

// Inject modal HTML into the body once
const modalHTML = `
<div id="restaurant-details-modal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
        <button class="modal-close" aria-label="Close modal">&times;</button>
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

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
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
    const photo = details.photo_url ? `<img src="${escapeHtml(details.photo_url)}" alt="${escapeHtml(details.name)}" class="modal-hero-img">` : '';
    const rating = details.rating ? `★ ${parseFloat(details.rating).toFixed(1)} (${details.user_rating_count || 0} reviews)` : '';
    
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
    if (details.phone_number) links += `<a href="tel:${details.phone_number}" class="modal-link">📞 ${escapeHtml(details.phone_number)}</a>`;
    if (details.website_url) links += `<a href="${details.website_url}" target="_blank" class="modal-link">🌐 ${escapeHtml(details.website_url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`;
    if (details.google_maps_url) links += `<a href="${details.google_maps_url}" target="_blank" class="modal-link">📍 View on Google Maps</a>`;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(details.name + ' ' + (details.address || ''))}`;
    links += `<a href="${googleSearchUrl}" target="_blank" class="modal-link">🔍 Search on Google</a>`;

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
            <h2>${escapeHtml(details.name)}</h2>
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
    modalBody.innerHTML = `<div class="spinner" style="margin: 40px auto; display: block;"></div>`;
    modal.style.display = 'flex';

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
