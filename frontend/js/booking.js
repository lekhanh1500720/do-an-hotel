/* ============================================
   booking.js - Booking confirmation & payment
   ============================================ */

// ---- Booking confirmation page (booking.html) ----
async function loadBookingSummary() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('bookingId');
  const box = document.getElementById('booking-summary');
  if (!bookingId) {
    box.innerHTML = '<div class="empty-state">No booking reference found.</div>';
    return;
  }
  box.innerHTML = '<div class="spinner"></div>';
  const data = await api.get('/bookings/' + bookingId);
  if (!data.success) {
    box.innerHTML = '<div class="empty-state">' + escapeHtml(data.message) + '</div>';
    return;
  }
  const b = data.booking;
  const statusBadge = {
    Pending: 'badge-warning', Confirmed: 'badge-success', CheckedIn: 'badge-info',
    CheckedOut: 'badge-muted', Cancelled: 'badge-danger',
  }[b.status] || 'badge-muted';

  box.innerHTML =
    '<div class="card"><div class="flex-between"><h2 class="card-title">Booking #' + b.booking_id + '</h2>' +
    '<span class="badge ' + statusBadge + '">' + b.status + '</span></div>' +
    '<div class="grid-2 mt-2">' +
    '<div><div class="muted small">HOTEL</div><div class="strong">' + escapeHtml(b.hotel_name) + ', ' + escapeHtml(b.city) + '</div></div>' +
    '<div><div class="muted small">ROOM</div><div>Room ' + escapeHtml(b.room_number) + ' · ' + escapeHtml(b.room_type) + '</div></div>' +
    '<div><div class="muted small">CHECK-IN</div><div>' + formatDate(b.check_in_date) + '</div></div>' +
    '<div><div class="muted small">CHECK-OUT</div><div>' + formatDate(b.check_out_date) + '</div></div>' +
    '<div><div class="muted small">PAYMENT</div><div>' + escapeHtml(b.payment_status || 'Not paid yet') + (b.transaction_ref ? ' · ' + escapeHtml(b.transaction_ref) : '') + '</div></div>' +
    '<div><div class="muted small">TOTAL AMOUNT</div><div class="price" style="font-size:1.3rem;font-weight:700;color:var(--primary)">' + formatCurrency(b.total_amount) + '</div></div>' +
    '</div></div>';

  const actions = document.getElementById('booking-actions');
  if (b.status === 'Pending') {
    actions.innerHTML = '<a class="btn btn-accent" href="payment.html?bookingId=' + b.booking_id + '">Proceed to Payment</a>';
  } else if (b.status === 'Confirmed' || b.status === 'CheckedIn') {
    actions.innerHTML = '<p class="muted">Your booking is ' + b.status.toLowerCase() + '. View it in your dashboard.</p>';
  }
}

// ---- Payment page (payment.html) ----
async function loadPaymentInfo() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('bookingId');
  const box = document.getElementById('payment-info');
  if (!bookingId) {
    box.innerHTML = '<div class="empty-state">No booking to pay for.</div>';
    return;
  }
  box.innerHTML = '<div class="spinner"></div>';
  const data = await api.get('/bookings/' + bookingId);
  if (!data.success) {
    box.innerHTML = '<div class="empty-state">' + escapeHtml(data.message) + '</div>';
    return;
  }
  const b = data.booking;
  document.getElementById('pay-booking-id').value = b.booking_id;
  box.innerHTML =
    '<div class="card"><h3 class="card-title">Payment for Booking #' + b.booking_id + '</h3>' +
    '<div class="muted">' + escapeHtml(b.hotel_name) + ', ' + escapeHtml(b.city) + '</div>' +
    '<div class="muted">Room ' + escapeHtml(b.room_number) + ' · ' + formatDate(b.check_in_date) + ' → ' + formatDate(b.check_out_date) + '</div>' +
    '<div class="mt-2 flex-between"><span>Total amount</span><span class="price" style="font-size:1.4rem;font-weight:700;color:var(--primary)">' + formatCurrency(b.total_amount) + '</span></div>' +
    (b.payment_status === 'Success'
      ? '<div class="alert alert-success mt-2">This booking is already paid and confirmed.</div>'
      : '') + '</div>';
}

async function processPayment(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const alertBox = document.getElementById('pay-alert');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const bookingId = document.getElementById('pay-booking-id').value;
  const payment_method = document.getElementById('payment_method').value;
  const card_number = document.getElementById('card_number').value.trim();
  const card_name = document.getElementById('card_name').value.trim();

  if (payment_method === 'Card' && (!card_number || !card_name)) {
    showAlert(alertBox, 'Please enter card details for card payment.', 'error');
    btn.disabled = false;
    btn.textContent = 'Pay Now';
    return;
  }

  const body = { booking_id: parseInt(bookingId, 10), payment_method: payment_method };
  if (payment_method === 'Card') body.card_number = card_number;

  try {
    const data = await api.post('/payments', body);
    if (data.success) {
      showAlert(alertBox, data.message, 'success');
      setTimeout(function () { window.location.href = 'customer-dashboard.html'; }, 1200);
    } else {
      showAlert(alertBox, data.message, 'error');
    }
  } catch (err) {
    showAlert(alertBox, err.message || 'Payment failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pay Now';
  }
}

// Toggle card fields based on selected payment method
function toggleCardFields() {
  const method = document.getElementById('payment_method').value;
  document.getElementById('card-fields').style.display = method === 'Card' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', function () {
  renderNavbar();
  if (document.getElementById('booking-summary')) loadBookingSummary();
  if (document.getElementById('payment-info')) {
    loadPaymentInfo();
    const form = document.getElementById('payment-form');
    if (form) form.addEventListener('submit', processPayment);
    const methodSel = document.getElementById('payment_method');
    if (methodSel) methodSel.addEventListener('change', toggleCardFields);
  }
});