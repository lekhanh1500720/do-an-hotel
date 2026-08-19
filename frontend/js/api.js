/* ============================================
   api.js - Fetch wrapper with auth token handling
   ============================================ */
const isLocalStaticServer =
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port !== '5000';
const API_BASE = isLocalStaticServer ? 'http://127.0.0.1:5000/api' : '/api';

// Token storage helpers
function getToken() {
  return localStorage.getItem('hms_token') || '';
}
function setToken(token) {
  localStorage.setItem('hms_token', token);
}
function getCurrentUser() {
  const raw = localStorage.getItem('hms_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function setCurrentUser(user) {
  localStorage.setItem('hms_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('hms_token');
  localStorage.removeItem('hms_user');
}

/**
 * Core request helper.
 * - Adds Authorization header when a token exists.
 * - Parses JSON responses into a consistent shape.
 * - On 401, clears the session (expired/invalid token).
 */
async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(API_BASE + path, options);
  } catch (err) {
    throw { success: false, message: 'Cannot reach the server. Is it running?', network: true };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = { success: false, message: 'Unexpected response from server.' };
  }

  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
    clearSession();
  }
  return data;
}

const api = {
  get: (path) => apiRequest('GET', path),
  post: (path, body) => apiRequest('POST', path, body),
  put: (path, body) => apiRequest('PUT', path, body),
  patch: (path, body) => apiRequest('PATCH', path, body),
  del: (path) => apiRequest('DELETE', path),
};

// Small helpers used across pages
function formatCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function todayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
function starRow(rating) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}