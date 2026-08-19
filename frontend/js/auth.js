/* ============================================
   auth.js - Login, register, navbar, page guards
   ============================================ */

// Render the shared navbar with role-aware links.
function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const user = getCurrentUser();
  let inner = `
    <a class="brand" href="index.html"><span>HMS</span> HotelManager</a>
    <nav class="nav-links">
      <a href="hotels.html">Hotels</a>
  `;

  if (user) {
    if (user.role === 'admin') {
      inner += `
        <a href="admin-dashboard.html">Dashboard</a>
        <a href="reports.html">Reports</a>
      `;
    } else {
      inner += `<a href="customer-dashboard.html">My Bookings</a>`;
    }
    inner += `
      <span class="user-chip">${escapeHtml(user.name)} (${user.role})</span>
      <button class="btn-logout" onclick="handleLogout()">Logout</button>
    `;
  } else {
    inner += `<a href="login.html">Login</a><a href="register.html">Register</a>`;
  }
  inner += `</nav>`;

  nav.innerHTML = inner;
}

function handleLogout() {
  clearSession();
  window.location.href = 'index.html';
}

// Redirect away from page if not authenticated / wrong role.
function requireAuth(role) {
  const user = getCurrentUser();
  if (!user || !getToken()) {
    window.location.href = 'login.html';
    return null;
  }
  if (role && user.role !== role) {
    window.location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'customer-dashboard.html';
    return null;
  }
  return user;
}

// ---------- Login ----------
async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const alertBox = document.getElementById('alert');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api.post('/auth/login', { email, password });
    if (data.success) {
      setToken(data.token);
      setCurrentUser(data.user);
      window.location.href = data.user.role === 'admin' ? 'admin-dashboard.html' : 'index.html';
    } else {
      showAlert(alertBox, data.message, 'error');
    }
  } catch (err) {
    showAlert(alertBox, err.message || 'Login failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

// ---------- Register ----------
async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const alertBox = document.getElementById('alert');
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirm').value;

  if (password !== confirm) {
    showAlert(alertBox, 'Passwords do not match.', 'error');
    btn.disabled = false;
    btn.textContent = 'Register';
    return;
  }

  try {
    const data = await api.post('/auth/register', { name, email, phone, password });
    if (data.success) {
      setToken(data.token);
      setCurrentUser(data.user);
      window.location.href = 'index.html';
    } else {
      showAlert(alertBox, data.message, 'error');
    }
  } catch (err) {
    showAlert(alertBox, err.message || 'Registration failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Register';
  }
}

function showAlert(box, message, type = 'info') {
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.style.display = 'block';
}

// Init on auth pages
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
});