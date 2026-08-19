/* ============================================
   dashboard.js - Customer dashboard
   ============================================ */

const bookingBadge = {
  Pending: 'badge-warning', Confirmed: 'badge-success', CheckedIn: 'badge-info',
  CheckedOut: 'badge-muted', Cancelled: 'badge-danger',
};

async function loadMyBookings() {
  const user = requireAuth('customer');
  if (!user) return;
  document.getElementById('welcome').textContent = 'Welcome, ' + user.name;
  const box = document.getElementById('bookings-list');
  box.innerHTML = '<div class="spinner"></div>';
  const data = await api.get('/bookings/my');
  if (!data.success) {
    box.innerHTML = '<div class="empty-state">' + escapeHtml(data.message) + '</div>';
    return;
  }
  if (data.bookings.length === 0) {
    box.innerHTML = '<div class="empty-state">No bookings yet. <a href="hotels.html">Search hotels</a> to get started.</div>';
    return;
  }
  box.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>#</th><th>Hotel</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Amount</th><th>Status</th><th>Payment</th><th>Actions</th>' +
    '</tr></thead><tbody>' + data.bookings.map(bookingRow).join('') + '</tbody></table></div>';
}

function bookingRow(b) {
  const statusBadge = '<span class="badge ' + (bookingBadge[b.status] || 'badge-muted') + '">' + b.status + '</span>';
  const payBadge = b.payment_status === 'Success'
    ? '<span class="badge badge-success">Paid</span>'
    : b.status === 'Pending' ? '<span class="badge badge-warning">Pay now</span>' : '<span class="badge badge-muted">' + escapeHtml(b.payment_status || '-') + '</span>';

  let actions = '';
  if (b.status === 'Pending') {
    actions += '<a class="btn btn-accent btn-sm" href="payment.html?bookingId=' + b.booking_id + '">Pay</a> ';
  }
  if (b.status === 'Pending' || b.status === 'Confirmed') {
    actions += '<button class="btn btn-danger btn-sm" onclick="cancelBooking(' + b.booking_id + ')">Cancel</button>';
  }
  if (b.status === 'CheckedOut') {
    actions += '<button class="btn btn-outline btn-sm" onclick="openReview(' + b.hotel_id + ')">Leave Review</button>';
  }

  return '<tr><td>' + b.booking_id + '</td><td><strong>' + escapeHtml(b.hotel_name) + '</strong><div class="small muted">' + escapeHtml(b.city) + '</div></td>' +
    '<td>' + escapeHtml(b.room_type) + ' · ' + escapeHtml(b.room_number) + '</td>' +
    '<td>' + formatDate(b.check_in_date) + '</td><td>' + formatDate(b.check_out_date) + '</td>' +
    '<td><strong>' + formatCurrency(b.total_amount) + '</strong></td>' +
    '<td>' + statusBadge + '</td><td>' + payBadge + '</td><td>' + actions + '</td></tr>';
}

async function cancelBooking(bookingId) {
  if (!confirm('Cancel this booking? The room will be released for those dates.')) return;
  const data = await api.patch('/bookings/' + bookingId + '/cancel', {});
  alert(data.message);
  loadMyBookings();
}

// ---- Review modal ----
async function openReview(hotelId) {
  const data = await api.get('/reviews/eligibility/' + hotelId);
  if (!data.success) { alert(data.message); return; }
  if (!data.eligible) {
    alert('You can only review a hotel after completing a checked-out stay.');
    return;
  }
  if (data.alreadyReviewed) {
    alert('You have already reviewed this hotel.');
    return;
  }
  document.getElementById('review-hotel-id').value = hotelId;
  document.getElementById('review-modal').style.display = 'flex';
}

function closeReview() {
  document.getElementById('review-modal').style.display = 'none';
}

async function submitReview(e) {
  e.preventDefault();
  const hotelId = document.getElementById('review-hotel-id').value;
  const rating = parseInt(document.getElementById('review-rating').value, 10);
  const comment = document.getElementById('review-comment').value.trim();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  const data = await api.post('/reviews', { hotel_id: parseInt(hotelId, 10), rating: rating, comment: comment });
  btn.disabled = false;
  alert(data.message);
  if (data.success) closeReview();
}

document.addEventListener('DOMContentLoaded', function () {
  renderNavbar();
  if (document.getElementById('bookings-list')) loadMyBookings();
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) reviewForm.addEventListener('submit', submitReview);
});