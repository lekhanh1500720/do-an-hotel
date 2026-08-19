/* ============================================
   admin.js - Admin dashboard (hotels, rooms, bookings, customers)
   ============================================ */

let adminHotels = [];
let adminRooms = [];

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  var tabBtn = document.querySelector('.tab[data-tab="' + tabName + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  document.getElementById('panel-' + tabName).classList.add('active');
}

async function loadOverview() {
  const data = await api.get('/reports/dashboard');
  if (!data.success) { document.getElementById('overview-cards').innerHTML = '<div class="alert alert-error">' + escapeHtml(data.message) + '</div>'; return; }
  const s = data.summary;
  document.getElementById('overview-cards').innerHTML =
    '<div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value">' + formatCurrency(s.total_revenue) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Bookings</div><div class="stat-value">' + s.total_bookings + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Customers</div><div class="stat-value">' + s.total_customers + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Hotels</div><div class="stat-value">' + s.total_hotels + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Rooms</div><div class="stat-value">' + s.total_rooms + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Occupancy (30d)</div><div class="stat-value">' + s.occupancy_rate + '%</div></div>';
}

// ---------- Hotels ----------
async function loadAdminHotels() {
  const data = await api.get('/hotels');
  if (!data.success) return;
  adminHotels = data.hotels;
  const tbody = document.querySelector('#hotels-table tbody');
  tbody.innerHTML = adminHotels.map(function (h) {
    return '<tr><td>' + h.hotel_id + '</td><td><strong>' + escapeHtml(h.name) + '</strong></td>' +
      '<td>' + escapeHtml(h.city) + '</td><td>' + starRow(h.star_rating) + '</td>' +
      '<td>' + h.total_rooms + '</td><td>★ ' + Number(h.avg_rating).toFixed(1) + '</td>' +
      '<td class="flex"><button class="btn btn-outline btn-sm" onclick="editHotel(' + h.hotel_id + ')">Edit</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteHotel(' + h.hotel_id + ')">Delete</button></td></tr>';
  }).join('');
}

function openHotelForm() {
  document.getElementById('hotel-form-modal').style.display = 'flex';
  document.getElementById('hotel-form').reset();
  document.getElementById('hotel-form-id').value = '';
  document.getElementById('hotel-form-title').textContent = 'Add Hotel';
}

function editHotel(id) {
  const h = adminHotels.find(function (x) { return x.hotel_id === id; });
  if (!h) return;
  document.getElementById('hotel-form-modal').style.display = 'flex';
  document.getElementById('hotel-form-title').textContent = 'Edit Hotel #' + id;
  document.getElementById('hotel-form-id').value = h.hotel_id;
  document.getElementById('h-name').value = h.name;
  document.getElementById('h-city').value = h.city;
  document.getElementById('h-address').value = h.address;
  document.getElementById('h-description').value = h.description || '';
  document.getElementById('h-star').value = h.star_rating;
  document.getElementById('h-image').value = h.image_url || '';
}

async function saveHotel(e) {
  e.preventDefault();
  const id = document.getElementById('hotel-form-id').value;
  const body = {
    name: document.getElementById('h-name').value.trim(),
    city: document.getElementById('h-city').value.trim(),
    address: document.getElementById('h-address').value.trim(),
    description: document.getElementById('h-description').value.trim(),
    star_rating: parseInt(document.getElementById('h-star').value, 10),
    image_url: document.getElementById('h-image').value.trim() || '',
  };
  const data = id
    ? await api.put('/hotels/' + id, body)
    : await api.post('/hotels', body);
  alert(data.message);
  if (data.success) { closeModal('hotel-form-modal'); loadAdminHotels(); loadAdminRooms(); }
}

async function deleteHotel(id) {
  if (!confirm('Delete this hotel and all its rooms?')) return;
  const data = await api.del('/hotels/' + id);
  alert(data.message);
  if (data.success) { loadAdminHotels(); loadAdminRooms(); }
}

// ---------- Rooms ----------
async function loadAdminRooms() {
  const data = await api.get('/rooms');
  if (!data.success) return;
  adminRooms = data.rooms;
  const tbody = document.querySelector('#rooms-table tbody');
  tbody.innerHTML = adminRooms.map(function (r) {
    const badge = r.status === 'Maintenance' ? 'badge-warning' : r.status === 'Booked' ? 'badge-danger' : 'badge-success';
    return '<tr><td>' + r.room_id + '</td><td><strong>' + escapeHtml(r.hotel_name) + '</strong></td>' +
      '<td>' + escapeHtml(r.room_number) + '</td><td>' + escapeHtml(r.room_type) + '</td>' +
      '<td>' + formatCurrency(r.price_per_night) + '</td><td>' + r.capacity + '</td>' +
      '<td><span class="badge ' + badge + '">' + r.status + '</span></td>' +
      '<td class="flex"><button class="btn btn-outline btn-sm" onclick="editRoom(' + r.room_id + ')">Edit</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteRoom(' + r.room_id + ')">Delete</button></td></tr>';
  }).join('');
  populateRoomHotelSelect();
}

function populateRoomHotelSelect() {
  const sel = document.getElementById('room-hotel');
  sel.innerHTML = '<option value="">Select hotel</option>' + adminHotels.map(function (h) {
    return '<option value="' + h.hotel_id + '">' + escapeHtml(h.name) + '</option>';
  }).join('');
}

function openRoomForm() {
  document.getElementById('room-form-modal').style.display = 'flex';
  document.getElementById('room-form').reset();
  document.getElementById('room-form-id').value = '';
  document.getElementById('room-form-title').textContent = 'Add Room';
  populateRoomHotelSelect();
}

function editRoom(id) {
  const r = adminRooms.find(function (x) { return x.room_id === id; });
  if (!r) return;
  populateRoomHotelSelect();
  document.getElementById('room-form-modal').style.display = 'flex';
  document.getElementById('room-form-title').textContent = 'Edit Room #' + id;
  document.getElementById('room-form-id').value = r.room_id;
  document.getElementById('room-hotel').value = r.hotel_id;
  document.getElementById('room-number').value = r.room_number;
  document.getElementById('room-type').value = r.room_type;
  document.getElementById('room-price').value = r.price_per_night;
  document.getElementById('room-capacity').value = r.capacity;
  document.getElementById('room-status').value = r.status;
  document.getElementById('room-image').value = r.image_url || '';
}

async function saveRoom(e) {
  e.preventDefault();
  const id = document.getElementById('room-form-id').value;
  const body = {
    hotel_id: parseInt(document.getElementById('room-hotel').value, 10),
    room_number: document.getElementById('room-number').value.trim(),
    room_type: document.getElementById('room-type').value,
    price_per_night: parseFloat(document.getElementById('room-price').value),
    capacity: parseInt(document.getElementById('room-capacity').value, 10),
    status: document.getElementById('room-status').value,
    image_url: document.getElementById('room-image').value.trim() || '',
  };
  const data = id ? await api.put('/rooms/' + id, body) : await api.post('/rooms', body);
  alert(data.message);
  if (data.success) { closeModal('room-form-modal'); loadAdminRooms(); }
}

async function deleteRoom(id) {
  if (!confirm('Delete this room?')) return;
  const data = await api.del('/rooms/' + id);
  alert(data.message);
  if (data.success) loadAdminRooms();
}

// ---------- Bookings ----------
async function loadAdminBookings() {
  const data = await api.get('/bookings');
  if (!data.success) return;
  const tbody = document.querySelector('#bookings-table tbody');
  tbody.innerHTML = data.bookings.map(function (b) {
    return '<tr><td>' + b.booking_id + '</td>' +
      '<td><strong>' + escapeHtml(b.customer_name) + '</strong><div class="small muted">' + escapeHtml(b.customer_email) + '</div></td>' +
      '<td>' + escapeHtml(b.hotel_name) + '</td><td>' + escapeHtml(b.room_type) + ' ' + escapeHtml(b.room_number) + '</td>' +
      '<td>' + formatDate(b.check_in_date) + '</td><td>' + formatDate(b.check_out_date) + '</td>' +
      '<td>' + formatCurrency(b.total_amount) + '</td>' +
      '<td><span class="badge ' + (bookingBadge[b.status] || 'badge-muted') + '">' + b.status + '</span></td>' +
      '<td><span class="badge ' + (b.payment_status === 'Success' ? 'badge-success' : 'badge-muted') + '">' + escapeHtml(b.payment_status || '-') + '</span></td>' +
      '<td class="flex">' + bookingActions(b) + '</td></tr>';
  }).join('');
}

function bookingActions(b) {
  let actions = '';
  if (b.status === 'Pending') {
    actions += '<button class="btn btn-success btn-sm" onclick="confirmBooking(' + b.booking_id + ')">Confirm</button>';
  }
  if (b.status === 'Confirmed') {
    actions += '<button class="btn btn-info btn-sm" onclick="checkInBooking(' + b.booking_id + ')">Check-in</button>';
  }
  if (b.status === 'CheckedIn') {
    actions += '<button class="btn btn-outline btn-sm" onclick="checkOutBooking(' + b.booking_id + ')">Check-out</button>';
  }
  if (b.status === 'Pending' || b.status === 'Confirmed') {
    actions += '<button class="btn btn-danger btn-sm" onclick="cancelBookingAdmin(' + b.booking_id + ')">Cancel</button>';
  }
  return actions || '<span class="muted small">—</span>';
}

async function confirmBooking(id) {
  const data = await api.patch('/bookings/' + id + '/confirm', {});
  alert(data.message); if (data.success) loadAdminBookings();
}
async function checkInBooking(id) {
  const data = await api.patch('/bookings/' + id + '/checkin', {});
  alert(data.message); if (data.success) loadAdminBookings();
}
async function checkOutBooking(id) {
  const data = await api.patch('/bookings/' + id + '/checkout', {});
  alert(data.message); if (data.success) loadAdminBookings();
}
async function cancelBookingAdmin(id) {
  if (!confirm('Cancel booking #' + id + '?')) return;
  const data = await api.patch('/bookings/' + id + '/cancel', {});
  alert(data.message); if (data.success) loadAdminBookings();
}

// ---------- Customers ----------
async function loadCustomers() {
  const search = document.getElementById('customer-search').value;
  const data = await api.get('/customers' + (search ? '?search=' + encodeURIComponent(search) : ''));
  if (!data.success) return;
  const tbody = document.querySelector('#customers-table tbody');
  tbody.innerHTML = data.customers.map(function (c) {
    return '<tr><td>' + c.user_id + '</td><td><strong>' + escapeHtml(c.name) + '</strong></td>' +
      '<td>' + escapeHtml(c.email) + '</td><td>' + escapeHtml(c.phone || '-') + '</td>' +
      '<td>' + c.booking_count + '</td><td>' + formatDate(c.created_at) + '</td>' +
      '<td><span class="badge ' + (c.is_active ? 'badge-success' : 'badge-danger') + '">' + (c.is_active ? 'Active' : 'Inactive') + '</span></td>' +
      '<td class="flex"><button class="btn btn-outline btn-sm" onclick="editCustomer(' + c.user_id + ')">Edit</button>' +
      '<button class="btn ' + (c.is_active ? 'btn-danger' : 'btn-success') + ' btn-sm" onclick="toggleCustomer(' + c.user_id + ', ' + (c.is_active ? 0 : 1) + ')">' +
      (c.is_active ? 'Deactivate' : 'Activate') + '</button></td></tr>';
  }).join('');
}

async function toggleCustomer(id, active) {
  if (!confirm((active ? 'Activate' : 'Deactivate') + ' this customer?')) return;
  const data = await api.patch('/customers/' + id + '/status', { is_active: !!active });
  alert(data.message); if (data.success) loadCustomers();
}

function openCustomerEdit(id) {
  // Simplified: prompt-based edit for name/phone
  const name = prompt('Customer name:');
  if (name === null) return;
  const phone = prompt('Phone (optional):', '');
  if (phone === null) return;
  const password = prompt('New password (optional, leave empty to keep):', '');
  if (password === null) return;
  api.put('/customers/' + id, { name: name, phone: phone, password: password }).then(function (data) {
    alert(data.message);
    if (data.success) loadCustomers();
  });
}

function editCustomer(id) { openCustomerEdit(id); }

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.addEventListener('DOMContentLoaded', function () {
  const user = requireAuth('admin');
  if (!user) return;
  document.getElementById('welcome').textContent = 'Welcome, ' + user.name;
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });
  loadOverview();
  loadAdminHotels();
  loadAdminRooms();
  loadAdminBookings();
  loadCustomers();
  document.getElementById('hotel-form').addEventListener('submit', saveHotel);
  document.getElementById('room-form').addEventListener('submit', saveRoom);
});