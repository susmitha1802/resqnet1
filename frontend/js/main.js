/**
 * ResQNet — Global Utilities
 * Session management, JWT expiry, route/role guards,
 * Navbar, toasts, scroll effects.
 */

/* ── Session / Auth Helpers ─────────────────────────────────────────────────── */
const Session = {
  KEYS: {
    user:  'resqnet_user',
    token: 'resqnet_token',
    role:  'resqnet_role',
  },

  /** Save user object, role and token to localStorage */
  set(user, token) {
    localStorage.setItem(this.KEYS.user,  JSON.stringify(user));
    localStorage.setItem(this.KEYS.role,  user.role || '');
    if (token) localStorage.setItem(this.KEYS.token, token);
  },

  get() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.user)); } catch { return null; }
  },

  /** Full logout — clears token, role, user, redirects to auth */
  logout(message = null) {
    localStorage.removeItem(this.KEYS.user);
    localStorage.removeItem(this.KEYS.token);
    localStorage.removeItem(this.KEYS.role);
    const url = message
      ? `auth.html?msg=${encodeURIComponent(message)}`
      : 'auth.html';
    location.href = url;
  },

  /** Legacy alias */
  clear() {
    localStorage.removeItem(this.KEYS.user);
    localStorage.removeItem(this.KEYS.token);
    localStorage.removeItem(this.KEYS.role);
  },

  isLoggedIn()  { return !!this.get() && !!this.getToken(); },
  role()        { return this.get()?.role || localStorage.getItem(this.KEYS.role) || null; },
  getToken()    { return localStorage.getItem(this.KEYS.token); },

  /**
   * Decode JWT expiry and check if token is still valid.
   * Returns false if missing, invalid or expired.
   */
  isTokenValid() {
    const token = this.getToken();
    if (!token || token.startsWith('demo-token-')) return !!this.get(); // demo mode
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // exp is in Unix seconds
      if (payload.exp && Date.now() / 1000 > payload.exp) return false;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check token expiry on every page load.
   * If expired, auto-logout with "session expired" message.
   */
  checkExpiry() {
    if (this.get() && !this.isTokenValid()) {
      this.logout('Your session has expired. Please log in again.');
    }
  },

  /**
   * Redirect logged-in user to their role-appropriate dashboard.
   * Called from auth page (after login) and on auth page load.
   */
  redirectIfLoggedIn() {
    if (!this.isLoggedIn()) return;
    const role = this.role();
    const map = {
      admin:     'admin-dashboard.html',
      volunteer: 'volunteer-dashboard.html',
      ngo:       'ngo-dashboard.html',
      victim:    'user-dashboard.html',
    };
    location.href = map[role] || 'user-dashboard.html';
  },

  /**
   * Route guard: require login + optionally a specific role.
   * If not logged in → redirect to auth.html.
   * If wrong role → show "Access Denied" and redirect to correct dashboard.
   */
  requireLogin(requiredRole = null) {
    // Check token validity first (handles expiry)
    this.checkExpiry();

    if (!this.isLoggedIn()) {
      location.href = 'auth.html';
      return false;
    }

    if (requiredRole && this.role() !== requiredRole) {
      Toast.show(`⛔ Access Denied — this page is for the "${requiredRole}" role only.`, 'danger', 4000);
      setTimeout(() => this.redirectIfLoggedIn(), 2000);
      return false;
    }
    return true;
  },

  /**
   * Shorthand role guard — returns false and redirects if role doesn't match.
   * Usage: Session.requireRole('victim')
   */
  requireRole(role) {
    return this.requireLogin(role);
  },
};


/* ── Toast Notifications ─────────────────────────────────────────────────────── */
const Toast = {
  container: null,

  init() {
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  },

  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => toast.remove(), 280);
    }, duration);
  }
};


/* ── Navbar scroll effect ─────────────────────────────────────────────────────── */
function initNavbar() {
  const navbar = document.querySelector('.resq-navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile hamburger */
  const toggler = navbar.querySelector('.navbar-toggler');
  const collapse = navbar.querySelector('.navbar-collapse');
  if (toggler && collapse) {
    toggler.addEventListener('click', () => collapse.classList.toggle('show'));
    document.addEventListener('click', (e) => {
      if (!navbar.contains(e.target)) collapse.classList.remove('show');
    });
  }

  updateNavbarAuth();
}

function updateNavbarAuth() {
  const user    = Session.get();
  const loginBtn    = document.getElementById('nav-login-btn');
  const registerBtn = document.getElementById('nav-register-btn');
  const dashBtn     = document.getElementById('nav-dashboard-btn');
  const logoutBtn   = document.getElementById('nav-logout-btn');

  if (user) {
    if (loginBtn)    loginBtn.style.display    = 'none';
    if (registerBtn) registerBtn.style.display = 'none';

    if (dashBtn) {
      dashBtn.style.display = 'inline-flex';
      const roleMap = {
        admin:     'admin-dashboard.html',
        volunteer: 'volunteer-dashboard.html',
        ngo:       'ngo-dashboard.html',
        victim:    'user-dashboard.html',
      };
      dashBtn.href = roleMap[user.role] || 'user-dashboard.html';
      dashBtn.textContent = `📊 My Dashboard`;
    }

    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
      logoutBtn.addEventListener('click', () => {
        Session.logout();
      });
    }
  } else {
    if (dashBtn)   dashBtn.style.display   = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}


/* ── Show session-expired message from URL param ───────────────────────────── */
function checkUrlMessage() {
  const msg = new URLSearchParams(location.search).get('msg');
  if (msg) {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => Toast.show(msg, 'warning', 5000), 500);
    });
  }
}


/* ── Intersection Observer animations ─────────────────────────────────────── */
function initScrollAnimations() {
  const els = document.querySelectorAll('[data-animate]');
  if (!els.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  els.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    el.style.transitionDelay = `${el.dataset.delay || 0}ms`;
    observer.observe(el);
  });
}


/* ── Counter animation ──────────────────────────────────────────────────────── */
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * ease).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target, parseInt(entry.target.dataset.counter));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
}


/* ── Mobile sidebar toggle for dashboards ───────────────────────────────────── */
function initSidebarToggle() {
  const btn     = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.querySelector('.resq-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('visible');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}


/* ── Format helpers ─────────────────────────────────────────────────────────── */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(iso) { return `${formatDate(iso)}, ${formatTime(iso)}`; }
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


/* ── Badge helpers ──────────────────────────────────────────────────────────── */
function priorityBadge(level) {
  const map = { High: 'high', Medium: 'medium', Low: 'low' };
  return `<span class="badge-${map[level] || 'low'}">${level}</span>`;
}
function statusBadge(status) {
  const map = { pending: 'pending', completed: 'completed', duplicate: 'duplicate', accepted: 'medium' };
  return `<span class="badge-${map[status?.toLowerCase()] || 'pending'}">${status}</span>`;
}


/* ── Logout helper (for inline onclick usage in HTML) ───────────────────────── */
function handleLogout() {
  Toast.show('Logged out successfully 👋', 'success');
  setTimeout(() => Session.logout(), 800);
}


/* ── Initialize on DOM ready ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  initNavbar();
  initScrollAnimations();
  initCounters();
  initSidebarToggle();
  checkUrlMessage();
});

/* Expose globals */
window.Session        = Session;
window.Toast          = Toast;
window.handleLogout   = handleLogout;
window.formatDate     = formatDate;
window.formatDateTime = formatDateTime;
window.timeAgo        = timeAgo;
window.priorityBadge  = priorityBadge;
window.statusBadge    = statusBadge;

/* ── Notification Bell Logic ── */
let notifOpen = false;

function toggleNotifDropdown() {
  notifOpen = !notifOpen;
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.toggle('open', notifOpen);
  if (notifOpen) {
    loadDummyNotifications();
    setTimeout(() => {
      const badge = document.getElementById('notif-badge');
      if (badge) badge.classList.add('hidden');
    }, 800);
  }
}

function closeNotifDropdown() {
  notifOpen = false;
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

function clearNotifications() {
  const list = document.getElementById('notif-list');
  if (list) list.innerHTML = '<div class="notif-empty">✅ All caught up! No new alerts.</div>';
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = '0'; badge.classList.add('hidden'); }
}

function loadDummyNotifications() {
  const list = document.getElementById('notif-list');
  if (!list || list.dataset.loaded) return;

  const role = Session.role() || 'victim';
  let items = [];

  // Generate role-specific dummy notifications
  if (role === 'victim') {
    items = [
      { dot: 'success', title: 'Request Accepted', sub: 'A volunteer has accepted your request. Help is on the way.' },
      { dot: 'medium', title: 'Status Update', sub: 'Your request for Medicine has been flagged as High Priority.' }
    ];
  } else if (role === 'volunteer') {
    items = [
      { dot: 'high', title: '🚨 Emergency Near You', sub: 'New Rescue request just 2.4 km away.' },
      { dot: 'success', title: 'Task Completed', sub: 'Your previous delivery was verified.' },
      { dot: 'medium', title: 'New Help Request', sub: 'A new request for Food is pending assignment.' }
    ];
  } else if (role === 'ngo') {
    items = [
      { dot: 'high', title: 'Critical Shortage', sub: 'Your Medicine stock is running low (< 10 units).' },
      { dot: 'success', title: 'Volunteer Assigned', sub: 'A volunteer was assigned to Request #102.' }
    ];
  } else {
    items = [
      { dot: 'high', title: '🚨 System Alert', sub: 'High volume of traffic in Hyderabad.' },
      { dot: 'medium', title: 'Duplicate Detected', sub: 'AI flagged 2 possible duplicate requests.' }
    ];
  }

  list.innerHTML = items.map(it => `
    <div class="notif-item" onclick="closeNotifDropdown()">
      <div class="notif-dot ${it.dot}"></div>
      <div>
        <div class="notif-item-title">${it.title}</div>
        <div class="notif-item-sub">${it.sub}</div>
      </div>
    </div>
  `).join('');
  
  list.dataset.loaded = 'true';
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('notif-wrapper');
  if (notifOpen && wrapper && !wrapper.contains(e.target)) closeNotifDropdown();
});

window.toggleNotifDropdown = toggleNotifDropdown;
window.closeNotifDropdown  = closeNotifDropdown;
window.clearNotifications  = clearNotifications;
