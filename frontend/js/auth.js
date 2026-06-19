/**
 * ResQNet — Auth Page Logic
 * 4-role selection, Login/Register toggle, form validation,
 * volunteer skills chips, NGO extras, admin secret code.
 */

let selectedRole = 'victim'; // default
let activeTab    = 'login';

/* ── Role Selection ─────────────────────────────────────────────────────────── */
function selectRole(role) {
  selectedRole = role;

  // Highlight selected card
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`role-${role}`);
  if (card) card.classList.add('selected');

  // Show/hide extras panels (register tab only)
  const volExtras   = document.getElementById('volunteer-extras');
  const ngoExtras   = document.getElementById('ngo-extras');
  const adminExtras = document.getElementById('admin-extras');
  if (volExtras)   volExtras.classList.toggle('visible',   role === 'volunteer');
  if (ngoExtras)   ngoExtras.classList.toggle('visible',   role === 'ngo');
  if (adminExtras) adminExtras.classList.toggle('visible', role === 'admin');

  // Update form heading
  updateHeading();
}

function updateHeading() {
  const heading = document.getElementById('form-heading');
  if (!heading) return;
  const roleLabels = {
    victim:    'User',
    volunteer: 'Volunteer',
    ngo:       'NGO / Organization',
    admin:     'Administrator',
  };
  const label = roleLabels[selectedRole] || 'User';
  heading.textContent = activeTab === 'login'
    ? `${label} Login`
    : `${label} Registration`;
}


/* ── Tab Switching ─────────────────────────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;
  const loginForm = document.getElementById('login-form-wrap');
  const regForm   = document.getElementById('register-form-wrap');
  const tabs      = document.querySelectorAll('.auth-tab');

  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (loginForm) loginForm.style.display = tab === 'login'    ? 'block' : 'none';
  if (regForm)   regForm.style.display   = tab === 'register' ? 'block' : 'none';

  updateHeading();
}


/* ── Skills Chips ──────────────────────────────────────────────────────────── */
function initSkillChips() {
  document.querySelectorAll('.skill-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}

function getSelectedSkills() {
  return [...document.querySelectorAll('.skill-chip.selected')].map(c => c.dataset.skill);
}


/* ── Password Strength ─────────────────────────────────────────────────────── */
function initPasswordStrength() {
  const pwdInput = document.getElementById('reg-password');
  const segments = document.querySelectorAll('.strength-segment');
  const text     = document.querySelector('.strength-text');
  if (!pwdInput) return;

  pwdInput.addEventListener('input', () => {
    const val = pwdInput.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const colors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    segments.forEach((seg, i) => {
      seg.style.background = i < score ? colors[score] : 'var(--bg-card-2)';
    });
    if (text) { text.textContent = val.length ? labels[score] : ''; text.style.color = colors[score]; }
  });
}


/* ── Password Toggle ─────────────────────────────────────────────────────── */
function initPasswordToggle() {
  document.querySelectorAll('.input-toggle[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isText = input.type === 'text';
      input.type  = isText ? 'password' : 'text';
      btn.textContent = isText ? '👁️' : '🙈';
    });
  });
}


/* ── Login Handler ─────────────────────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  if (!email || !password) {
    Toast.show('Please fill in all fields', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="resq-spinner" style="width:20px;height:20px;"></span> Signing in...';

  const data = await Api.post('/login', { email, password });

  if (data?.token && data?.user) {
    // ── Real API success ─────────────────────────────────────────────────────
    Session.set(data.user, data.token);
    Toast.show(`Welcome back, ${data.user.name.split(' ')[0]}! 👋`, 'success');
    setTimeout(() => Session.redirectIfLoggedIn(), 1000);
    return;
  }

  // API error response
  const errorMsg = data?.message || 'Invalid email or password';
  Toast.show(errorMsg, 'danger');
  btn.disabled = false;
  btn.innerHTML = '🔑 Sign In';
}


/* ── Register Handler ──────────────────────────────────────────────────────── */
async function handleRegister(e) {
  e.preventDefault();

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn      = document.getElementById('register-btn');

  // Validation
  if (!name || !email || !phone || !password || !confirm) {
    Toast.show('Please fill in all required fields', 'warning');
    return;
  }
  if (password !== confirm) {
    Toast.show('Passwords do not match', 'danger');
    return;
  }
  if (password.length < 6) {
    Toast.show('Password must be at least 6 characters', 'warning');
    return;
  }

  // Build payload
  const body = { name, email, phone, password, role: selectedRole };

  if (selectedRole === 'volunteer') {
    body.skills       = getSelectedSkills();
    body.location     = document.getElementById('vol-location')?.value.trim() || '';
    body.availability = document.getElementById('vol-availability')?.checked ? 'available' : 'unavailable';
  }

  if (selectedRole === 'ngo') {
    const orgName = document.getElementById('ngo-org-name')?.value.trim();
    if (!orgName) {
      Toast.show('Organization name is required for NGO registration', 'warning');
      return;
    }
    body.org_name = orgName;
    body.org_type = document.getElementById('ngo-org-type')?.value || 'Disaster Relief NGO';
    body.area     = document.getElementById('ngo-area')?.value.trim() || '';
  }

  if (selectedRole === 'admin') {
    const secretCode = document.getElementById('admin-secret-code')?.value.trim();
    if (!secretCode) {
      Toast.show('Admin secret code is required', 'warning');
      return;
    }
    body.admin_secret_code = secretCode;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="resq-spinner" style="width:20px;height:20px;"></span> Creating account...';

  const data = await Api.post('/register', body);

  if (data?.user && data?.token) {
    Session.set(data.user, data.token);
    Toast.show(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`, 'success');
    setTimeout(() => Session.redirectIfLoggedIn(), 1200);
    return;
  }

  const errorMsg = data?.message || 'Registration failed. Please try again.';
  Toast.show(errorMsg, 'danger');
  btn.disabled = false;
  btn.innerHTML = '📝 Create Account';
}


/* ── Init ──────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Default role
  selectRole('victim');
  switchTab('login');
  initSkillChips();
  initPasswordStrength();
  initPasswordToggle();

  // Role card clicks
  ['victim', 'volunteer', 'ngo', 'admin'].forEach(role => {
    document.getElementById(`role-${role}`)?.addEventListener('click', () => selectRole(role));
  });

  // Tab clicks
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Form submits
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);

  // If already logged in, redirect away from auth page
  Session.redirectIfLoggedIn();
});
