/* ============================================
   roomDetails.js - Hotel detail, availability, booking
   ============================================ */
let hotelData = null;

async function loadHotel() {
  const params = new URLSearchParams(window.location.search);
  const hotelId = params.get('hotelId');
  const container = document.getElementById('hotel-detail');
  if (!hotelId) {
    container.innerHTML = '<div class="empty-state">No hotel selected.</div>';
    return;
  }
  container.innerHTML = '<div class="spinner"></div>';
  const data = await api.get('/hotels/' + hotelId);
  if (!data.success) {
    container.innerHTML = '<div class="empty-state">' + escapeHtml(data.message || 'Hotel not found.') + '</div>';
    return;
  }
  hotelData = data;
  renderHotel(data.hotel);
  renderReviews(data.reviews, data.hotel.avg_rating);

  if (params.get('check_in')) document.getElementById('check_in').value = params.get('check_in');
  if (params.get('check_out')) document.getElementById('check_out').value = params.get('check_out');

  const checkIn = document.getElementById('check_in').value;
  const checkOut = document.getElementById('check_out').value;
  if (checkIn && checkOut) {
    checkAvailability();
  } else {
    renderAllRooms(data.rooms);
  }
}

function renderHotel(h) {
  const stars = starRow(h.star_rating);
  document.getElementById('hotel-detail').innerHTML =
    '<div class="card"><div class="flex-between"><div><h1 class="page-title">' + escapeHtml(h.name) + '</h1>' +
    '<div class="meta">' + escapeHtml(h.address) + ', ' + escapeHtml(h.city) + ' · <span class="stars">' + stars + '</span></div></div>' +
    '<span class="rating-badge">★ ' + Number(h.avg_rating).toFixed(1) + ' (' + h.review_count + ' reviews)</span></div>' +
    (h.image_url ? '<img src="' + escapeHtml(h.image_url) + '" alt="' + escapeHtml(h.name) + '" style="width:100%;max-height:340px;object-fit:cover;border-radius:10px;margin-top:1rem;">' : '') +
    (h.description ? '<p class="mt-2">' + escapeHtml(h.description) + '</p>' : '') + '</div>';
}

function renderReviews(reviews, avgRating) {
  const box = document.getElementById('reviews');
  if (reviews.length === 0) {
    box.innerHTML = '<div class="empty-state">No reviews yet. Be the first to share your experience.</div>';
    return;
  }
  box.innerHTML =
    '<div class="flex-between mb-2"><h3>Guest Reviews</h3><span class="rating-badge">★ ' + Number(avgRating).toFixed(1) + ' average</span></div>' +
    reviews.map(function (r) {
      return '<div class="review-item"><div class="head"><span class="name">' + escapeHtml(r.user_name) + '</span>' +
        '<span class="stars small">' + starRow(r.rating) + '</span></div>' +
        (r.comment ? '<p>' + escapeHtml(r.comment) + '</p>' : '') +
        '<div class="small muted">' + formatDate(r.created_at) + '</div></div>';
    }).join('');
}

function getSelectedDates() {
  const checkIn = document.getElementById('check_in').value;
  const checkOut = document.getElementById('check_out').value;
  if (!checkIn || !checkOut) return { error: 'Please select both check-in and check-out dates.' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(checkIn + 'T00:00:00') < today) return { error: 'Check-in date cannot be in the past.' };
  if (new Date(checkOut) <= new Date(checkIn)) return { error: 'Check-out must be after check-in.' };
  return { checkIn: checkIn, checkOut: checkOut };
}

function renderAllRooms(rooms) {
  const roomList = document.getElementById('room-list');
  document.getElementById('availability-banner').innerHTML = '';
  if (rooms.length === 0) {
    roomList.innerHTML = '<div class="empty-state">This hotel has no rooms yet.</div>';
    return;
  }
  roomList.innerHTML = rooms.map(function (r) {
    return renderRoomRow(r, r.status === 'Available');
  }).join('');
}

function renderRoomRow(room, selectable) {
  const badge = room.status === 'Maintenance' ? '<span class="badge badge-warning">Maintenance</span>'
    : room.status === 'Booked' ? '<span class="badge badge-danger">Booked</span>'
      : '<span class="badge badge-success">Available</span>';
  return '<div class="room-card">' +
    '<img src="' + escapeHtml(room.image_url || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400') + '" alt="Room" onerror="this.style.display=\'none\'">' +
    '<div class="room-card-body"><div class="flex-between"><span class="room-type">' + escapeHtml(room.room_type) + '</span>' + badge + '</div>' +
    '<h3>Room ' + escapeHtml(room.room_number) + '</h3>' +
    '<div class="meta">Sleeps ' + room.capacity + ' · ' + escapeHtml(room.room_type) + ' room</div>' +
    '<div class="price">' + formatCurrency(room.price_per_night) + ' <span class="small muted">/night</span></div></div>' +
    '<div class="room-card-actions">' +
    (selectable ? '<button class="btn btn-accent" onclick="bookRoom(' + room.room_id + ')">Book Now</button>'
      : '<button class="btn btn-ghost" disabled>Unavailable</button>') +
    '</div></div>';
}

async function checkAvailability() {
  const dates = getSelectedDates();
  const banner = document.getElementById('availability-banner');
  const roomList = document.getElementById('room-list');
  if (dates.error) {
    banner.innerHTML = '<div class="alert alert-error">' + escapeHtml(dates.error) + '</div>';
    return;
  }
  if (!hotelData) return;
  banner.innerHTML = '<div class="alert alert-info">Checking availability...</div>';
  roomList.innerHTML = '';
  const data = await api.get('/rooms/hotel/' + hotelData.hotel.hotel_id + '/available?check_in=' + dates.checkIn + '&check_out=' + dates.checkOut);
  if (!data.success) {
    banner.innerHTML = '<div class="alert alert-error">' + escapeHtml(data.message || 'Failed to check availability.') + '</div>';
    return;
  }
  if (data.rooms.length === 0) {
    banner.innerHTML = '<div class="alert alert-warning">No rooms available for these dates. Try different dates.</div>';
    roomList.innerHTML = '';
    return;
  }
  banner.innerHTML = '<div class="alert alert-success">' + data.rooms.length + ' room(s) available for ' + formatDate(dates.checkIn) + ' → ' + formatDate(dates.checkOut) + '.</div>';
  roomList.innerHTML = data.rooms.map(function (r) { return renderRoomRow(r, true); }).join('');
  window.selectedDates = dates;
}

async function bookRoom(roomId) {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  let dates = window.selectedDates;
  if (!dates) {
    dates = getSelectedDates();
    if (dates.error) {
      document.getElementById('availability-banner').innerHTML = '<div class="alert alert-error">' + escapeHtml(dates.error) + '</div>';
      return;
    }
  }
  const data = await api.post('/bookings', {
    room_id: roomId,
    check_in_date: dates.checkIn,
    check_out_date: dates.checkOut,
  });
  if (data.success) {
    window.location.href = 'booking.html?bookingId=' + data.booking_id;
  } else {
    document.getElementById('availability-banner').innerHTML = '<div class="alert alert-error">' + escapeHtml(data.message) + '</div>';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  renderNavbar();
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  document.getElementById('check_in').min = today;
  document.getElementById('check_out').min = today;
  document.getElementById('availability-form').addEventListener('submit', function (e) {
    e.preventDefault();
    checkAvailability();
  });
  loadHotel();
});