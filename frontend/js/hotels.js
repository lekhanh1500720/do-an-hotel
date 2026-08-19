/* ============================================
   hotels.js - Hotel search & listing
   ============================================ */

function renderHotelCard(h) {
  const stars = starRow(h.star_rating);
  const price = h.min_price
    ? `<div class="price">From ${formatCurrency(h.min_price)} <span class="small muted">/night</span></div>`
    : `<div class="price muted">Rooms unavailable</div>`;
  const rating = h.review_count > 0
    ? `<span class="rating-badge">★ ${Number(h.avg_rating).toFixed(1)} · ${h.review_count} review${h.review_count > 1 ? 's' : ''}</span>`
    : `<span class="rating-badge muted">No reviews yet</span>`;

  return `
    <article class="hotel-card">
      <img src="${escapeHtml(h.image_url || 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800')}" alt="${escapeHtml(h.name)}" onerror="this.src='https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800'">
      <div class="hotel-card-body">
        <div class="flex-between">
          <h3>${escapeHtml(h.name)}</h3>
          <span class="stars">${stars}</span>
        </div>
        <div class="meta">📍 ${escapeHtml(h.city)} · ${h.available_rooms}/${h.total_rooms} rooms free</div>
        ${rating}
        ${price}
        <a class="btn btn-primary btn-block" href="room-details.html?hotelId=${h.hotel_id}">View Rooms</a>
      </div>
    </article>
  `;
}

async function loadHotels(filters = {}) {
  const grid = document.getElementById('hotel-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="spinner"></div>';

  const params = new URLSearchParams();
  if (filters.city) params.set('city', filters.city);
  if (filters.min_price) params.set('min_price', filters.min_price);
  if (filters.max_price) params.set('max_price', filters.max_price);
  if (filters.star_rating) params.set('star_rating', filters.star_rating);

  const qs = params.toString();
  const data = await api.get('/hotels' + (qs ? '?' + qs : ''));

  if (!data.success) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(data.message || 'Failed to load hotels.')}</div>`;
    return;
  }

  if (data.hotels.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>No hotels found</h3><p>Try adjusting your search filters.</p></div>`;
    return;
  }

  grid.innerHTML = data.hotels.map(renderHotelCard).join('');
}

function setupSearchForm() {
  const form = document.getElementById('search-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    loadHotels({
      city: document.getElementById('filter-city').value.trim(),
      min_price: document.getElementById('filter-min').value || '',
      max_price: document.getElementById('filter-max').value || '',
      star_rating: document.getElementById('filter-stars').value || '',
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  setupSearchForm();
  // Prefill city from query string (?city=...)
  const url = new URLSearchParams(window.location.search);
  const city = url.get('city');
  if (city && document.getElementById('filter-city')) {
    document.getElementById('filter-city').value = city;
  }
  loadHotels({ city: city || '' });
});