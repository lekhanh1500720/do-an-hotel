/* ============================================
   reports.js - Admin reports with simple charts
   ============================================ */

function chartBar(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 20, right: 10, bottom: 40, left: 55 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const max = Math.max.apply(null, values.concat([1]));
  const barW = Math.min(60, (chartW / values.length) * 0.6);

  ctx.font = '12px Segoe UI, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    const y = pad.top + chartH - (chartH * i) / 4;
    ctx.strokeStyle = '#e6eaf0';
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#8a97a8';
    ctx.fillText(v.toFixed(0), pad.left - 8, y + 4);
  }

  values.forEach(function (v, i) {
    const barH = (v / max) * chartH;
    const x = pad.left + (chartW / values.length) * i + (chartW / values.length - barW) / 2;
    const y = pad.top + chartH - barH;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();
    // value label
    ctx.fillStyle = '#22303f';
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.toFixed(v % 1 === 0 ? 0 : 1), x + barW / 2, y - 6);
    // x label
    ctx.fillStyle = '#6b7a8d';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText(String(labels[i]), x + barW / 2, h - pad.bottom + 16);
  });
}

async function loadRevenueReport() {
  const from = document.getElementById('rev-from').value;
  const to = document.getElementById('rev-to').value;
  if (!from || !to) return;
  const data = await api.get('/reports/revenue?from=' + from + '&to=' + to);
  if (!data.success) {
    document.getElementById('revenue-result').innerHTML = '<div class="alert alert-error">' + escapeHtml(data.message) + '</div>';
    return;
  }
  document.getElementById('revenue-result').innerHTML =
    '<div class="stat-grid">' +
    '<div class="stat-card"><div class="stat-label">Revenue (' + from + ' → ' + to + ')</div><div class="stat-value">' + formatCurrency(data.total_revenue) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Successful transactions</div><div class="stat-value">' + data.total_transactions + '</div></div>' +
    '</div>';
}

async function loadOccupancyReport() {
  const data = await api.get('/reports/occupancy');
  if (!data.success) return;
  const labels = data.occupancy.map(function (r) { return r.hotel_name.length > 14 ? r.hotel_name.slice(0, 13) + '…' : r.hotel_name; });
  const values = data.occupancy.map(function (r) { return r.occupancy_rate; });
  chartBar('occupancy-chart', labels, values, '#1e3a5f');
  document.getElementById('occupancy-table').innerHTML =
    '<div class="table-wrap"><table><thead><tr><th>Hotel</th><th>Rooms</th><th>Occupied room-nights</th><th>Occupancy rate</th></tr></thead><tbody>' +
    data.occupancy.map(function (r) {
      return '<tr><td><strong>' + escapeHtml(r.hotel_name) + '</strong></td><td>' + r.total_rooms + '</td><td>' + r.occupied_room_nights + '</td><td>' + r.occupancy_rate + '%</td></tr>';
    }).join('') + '</tbody></table></div>';
}

async function loadStatusReport() {
  const data = await api.get('/reports/bookings-by-status');
  if (!data.success) return;
  chartBar('status-chart', data.statuses.map(function (s) { return s.status; }), data.statuses.map(function (s) { return s.count; }), '#e2a83b');
}

async function loadTopRatedReport() {
  const data = await api.get('/reports/top-rated-hotels');
  if (!data.success) return;
  document.getElementById('top-rated').innerHTML = data.hotels.length
    ? '<div class="table-wrap"><table><thead><tr><th>Hotel</th><th>City</th><th>Avg rating</th><th>Reviews</th></tr></thead><tbody>' +
      data.hotels.map(function (h) {
        return '<tr><td><strong>' + escapeHtml(h.hotel_name) + '</strong></td><td>' + escapeHtml(h.city) + '</td>' +
          '<td>' + starRow(h.avg_rating) + ' ' + Number(h.avg_rating).toFixed(1) + '</td><td>' + h.review_count + '</td></tr>';
      }).join('') + '</tbody></table></div>'
    : '<div class="empty-state">No reviews yet.</div>';
}

document.addEventListener('DOMContentLoaded', function () {
  const user = requireAuth('admin');
  if (!user) return;
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  document.getElementById('rev-from').value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById('rev-to').value = today.toISOString().split('T')[0];

  loadRevenueReport();
  loadOccupancyReport();
  loadStatusReport();
  loadTopRatedReport();
  document.getElementById('rev-form').addEventListener('submit', function (e) { e.preventDefault(); loadRevenueReport(); });
});