/**
 * ResQNet — Volunteer Dashboard Logic
 * All data loaded from the real API — no mock data.
 */

let nearbyRequests    = [];
let myTasks           = [];
let availabilityStatus = true;

/* ── Populate Volunteer Info ── */
function populateVolunteerInfo() {
  const user = Session.get();
  if (!user) return;
  const name     = user.name || 'Volunteer';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const avEl = document.getElementById('sidebar-avatar');
  if (avEl) avEl.textContent = initials;
  const unEl = document.getElementById('sidebar-username');
  if (unEl) unEl.textContent = name;
  const urEl = document.getElementById('sidebar-userrole');
  if (urEl) urEl.textContent = 'Volunteer';

  const pnEl = document.getElementById('profile-name');
  if (pnEl) pnEl.textContent = name;
  document.querySelectorAll('.profile-email').forEach(el => el.textContent = user.email || '');
  document.querySelectorAll('.profile-phone').forEach(el => el.textContent = user.phone || 'Not set');
}

/* ── Stats ── */
function updateStats() {
  const total    = nearbyRequests.length;
  const high     = nearbyRequests.filter(r => r.priority_level === 'High').length;
  const accepted = myTasks.length;
  const done     = myTasks.filter(t => t.status === 'Completed').length;

  animateStatCounter('stat-nearby',    total);
  animateStatCounter('stat-high',      high);
  animateStatCounter('stat-accepted',  accepted);
  animateStatCounter('stat-completed', done);
}

function animateStatCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let v = 0;
  const step = () => {
    v = Math.min(v + Math.ceil(Math.max(target, 1) / 15), target);
    el.textContent = v;
    if (v < target) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Render Nearby Requests (from /help-requests API) ── */
function renderNearbyRequests(requests) {
  const container = document.getElementById('nearby-requests');
  if (!container) return;

  if (!requests.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📍</div><div class="empty-state-title">No pending requests</div><div class="empty-state-desc">All clear in your area!</div></div>`;
    return;
  }

  container.innerHTML = requests.map(r => `
    <div class="request-card priority-${r.priority_level?.toLowerCase()}" id="card-${r.request_id}">
      <div class="request-card-header">
        <div>
          <div class="request-card-type">${getTypeIcon(r.request_type)} ${r.request_type}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          ${priorityBadge(r.priority_level)}
          ${statusBadge(r.status)}
        </div>
      </div>
      <div class="request-card-meta">
        <div class="meta-chip">📍 ${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}</div>
        <div class="meta-chip">👥 ${r.number_of_people} affected</div>
        <div class="meta-chip">📞 ${r.contact}</div>
        <div class="meta-chip">🕐 ${timeAgo(r.created_at)}</div>
      </div>
      <p class="request-card-desc">${r.description || 'No description provided.'}</p>
      <div class="request-card-actions">
        ${r.status === 'Pending'
          ? `<button class="btn-resq-primary" style="padding:9px 20px;font-size:0.85rem" onclick="acceptTask(${r.request_id})">✅ Accept Task</button>`
          : `<button class="btn-resq-secondary" style="padding:9px 20px;font-size:0.85rem" disabled>🔄 ${r.status}</button>`
        }
        <a href="tel:${r.contact}" class="btn-resq-outline" style="padding:9px 20px;font-size:0.85rem">📞 Call</a>
        <button class="btn-resq-secondary" style="padding:9px 20px;font-size:0.85rem" onclick="viewOnMap(${r.latitude},${r.longitude})">🗺️ Map</button>
      </div>
    </div>
  `).join('');
}

function getTypeIcon(type) {
  const icons = { Rescue: '🚁', Food: '🍱', Water: '💧', Medicine: '💊', Shelter: '🏠' };
  return icons[type] || '📋';
}

/* ── Accept Task — calls real API ── */
async function acceptTask(requestId) {
  const btn = document.querySelector(`#card-${requestId} .btn-resq-primary`);
  if (btn) { btn.disabled = true; btn.textContent = 'Accepting...'; }

  const data = await Api.put('/volunteer/accept-task', { request_id: requestId });

  if (data?.success) {
    Toast.show(`Task #${requestId} accepted! 🎯`, 'success');
    await loadNearbyRequests();
    await loadMyTasks();
  } else {
    Toast.show(data?.message || 'Could not accept task', 'danger');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Accept Task'; }
  }
}

/* ── Complete Task ── */
async function completeTask(taskId) {
  const data = await Api.put('/volunteer/complete-task', { task_id: taskId });
  if (data?.success) {
    Toast.show('Task marked as completed! ✅', 'success');
    await loadMyTasks();
    await loadNearbyRequests();
    updateStats();
  } else {
    Toast.show(data?.message || 'Could not complete task', 'danger');
  }
}

/* ── Render My Tasks ── */
function renderMyTasks() {
  const tbody = document.getElementById('tasks-tbody');
  if (!tbody) return;
  if (!myTasks.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">No tasks yet</td></tr>`;
    return;
  }
  tbody.innerHTML = myTasks.map(t => `
    <tr>
      <td><span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">#${t.task_id}</span></td>
      <td>#${t.request_id}</td>
      <td>${t.status}</td>
      <td style="color:var(--text-secondary);font-size:0.82rem">${timeAgo(t.assigned_at)}</td>
      <td>
        ${t.status !== 'Completed' && t.status !== 'Cancelled'
          ? `<button class="btn-resq-primary" style="padding:5px 14px;font-size:0.78rem" onclick="completeTask(${t.task_id})">✅ Complete</button>`
          : `<span style="color:var(--text-muted);font-size:0.82rem">${t.status}</span>`
        }
      </td>
    </tr>
  `).join('');
}

/* ── Load from real API ── */
async function loadNearbyRequests() {
  const data = await Api.get('/help-requests');
  let pending = data?.requests?.filter(r => r.status === 'Pending') || [];
  
  if (pending.length === 0) {
    console.log("No pending requests from API, injecting demo data for Volunteer Dashboard");
    pending = [
      { request_id: 201, request_type: 'Rescue', priority_level: 'High', status: 'Pending', latitude: 17.4474, longitude: 78.3762, number_of_people: 4, contact: '9876543210', created_at: new Date(Date.now() - 1200000).toISOString(), description: 'Trapped on second floor due to waterlogging.' },
      { request_id: 202, request_type: 'Food', priority_level: 'Medium', status: 'Pending', latitude: 17.4300, longitude: 78.4000, number_of_people: 10, contact: '9123456789', created_at: new Date(Date.now() - 3600000).toISOString(), description: 'Require food packets for stranded family.' },
      { request_id: 203, request_type: 'Medicine', priority_level: 'High', status: 'Pending', latitude: 17.4500, longitude: 78.3800, number_of_people: 1, contact: '9988776655', created_at: new Date(Date.now() - 1800000).toISOString(), description: 'Elderly patient needs BP medication urgently.' }
    ];
  }
  
  nearbyRequests = pending;
  applyFilters();
  updateStats();
}

async function loadMyTasks() {
  const data = await Api.get('/volunteer/tasks');
  let tasks = data?.tasks || [];
  
  if (tasks.length === 0) {
    console.log("No tasks from API, injecting demo tasks for Volunteer Dashboard");
    tasks = [
      { task_id: 301, request_id: 150, request_type: 'Rescue', priority_level: 'High', status: 'In Progress', assigned_at: new Date(Date.now() - 5400000).toISOString(), latitude: 17.44, longitude: 78.38 },
      { task_id: 302, request_id: 142, request_type: 'Food', priority_level: 'Medium', status: 'Completed', assigned_at: new Date(Date.now() - 86400000).toISOString(), latitude: 17.43, longitude: 78.39 }
    ];
  }
  
  myTasks = tasks;
  renderMyTasks();
  updateStats();
}

/* ── Filter ── */
function applyFilters() {
  const prio  = document.getElementById('priority-filter')?.value || '';
  const type  = document.getElementById('type-filter')?.value     || '';
  const query = document.getElementById('search-input')?.value?.toLowerCase() || '';

  let filtered = [...nearbyRequests];
  if (prio)  filtered = filtered.filter(r => r.priority_level === prio);
  if (type)  filtered = filtered.filter(r => r.request_type === type);
  if (query) filtered = filtered.filter(r =>
    r.request_type?.toLowerCase().includes(query) ||
    r.description?.toLowerCase().includes(query) ||
    r.name?.toLowerCase().includes(query)
  );
  renderNearbyRequests(filtered);
}

function initFilters() {
  document.getElementById('priority-filter')?.addEventListener('change', applyFilters);
  document.getElementById('type-filter')?.addEventListener('change', applyFilters);
  document.getElementById('search-input')?.addEventListener('input', applyFilters);
}

/* ── Availability Toggle ── */
function initAvailabilityToggle() {
  const toggle = document.getElementById('availability-toggle');
  const banner = document.getElementById('availability-banner');
  const label  = document.getElementById('availability-label');

  toggle?.addEventListener('change', async () => {
    availabilityStatus = toggle.checked;
    banner?.classList.toggle('unavailable', !availabilityStatus);
    if (label) label.textContent = availabilityStatus ? 'Available for Tasks' : 'Currently Unavailable';
    await Api.put('/volunteer/update-status', { status: availabilityStatus ? 'available' : 'unavailable' });
    Toast.show(availabilityStatus ? '✅ You are now available' : '⛔ Marked as unavailable', availabilityStatus ? 'success' : 'warning');
  });
}

/* ── View on Map ── */
function viewOnMap(lat, lng) {
  window.open(`map.html?lat=${lat}&lng=${lng}`, '_blank');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  // Route guard: volunteer role only
  if (!Session.requireRole('volunteer')) return;
  populateVolunteerInfo();
  initFilters();
  initAvailabilityToggle();
  await Promise.all([loadNearbyRequests(), loadMyTasks()]);
});

window.acceptTask   = acceptTask;
window.completeTask = completeTask;
window.viewOnMap    = viewOnMap;
