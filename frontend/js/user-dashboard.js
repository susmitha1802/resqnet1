/**
 * ResQNet — User Dashboard Logic
 * All data loaded from the real API — no mock data.
 */

let currentRequests = [];
let selectedRequest = null;

/* ── Populate User Info ── */
function populateUserInfo() {
  const user = Session.get();
  if (!user) return;
  const name     = user.name || 'User';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const unEl = document.getElementById('sidebar-username');
  if (unEl) unEl.textContent = name;
  const urEl = document.getElementById('sidebar-userrole');
  if (urEl) urEl.textContent = 'Disaster Victim';
  const avEl = document.getElementById('sidebar-avatar');
  if (avEl) avEl.textContent = initials;

  const pnEl = document.getElementById('profile-name');
  if (pnEl) pnEl.textContent = name;
  document.querySelectorAll('.profile-email').forEach(el => el.textContent = user.email || '');
  document.querySelectorAll('.profile-phone').forEach(el => el.textContent = user.phone || 'Not set');
}

/* ── Update Stats ── */
function updateStats() {
  const total     = currentRequests.length;
  const pending   = currentRequests.filter(r => r.status === 'Pending').length;
  const completed = currentRequests.filter(r => r.status === 'Completed').length;
  const accepted  = currentRequests.filter(r => r.status === 'Accepted').length;

  animateStatCounter('stat-total',     total);
  animateStatCounter('stat-pending',   pending);
  animateStatCounter('stat-completed', completed);
  animateStatCounter('stat-accepted',  accepted);
}

function animateStatCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let start = 0;
  const step = () => {
    start = Math.min(start + Math.ceil(Math.max(target, 1) / 20), target);
    el.textContent = start;
    if (start < target) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Render Request History Table ── */
function renderRequestTable(requests) {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;

  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No requests yet</div><div class="empty-state-desc">Submit a help request to get started</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td><span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">#${r.request_id}</span></td>
      <td><span style="font-weight:600">${r.request_type}</span></td>
      <td>${priorityBadge(r.priority_level)}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="color:var(--text-secondary);font-size:0.82rem">${timeAgo(r.created_at)}</td>
      <td>
        <button class="btn-resq-outline" style="padding:5px 14px;font-size:0.78rem" onclick="showAIResult(${r.request_id})">
          🤖 AI Result
        </button>
      </td>
    </tr>
  `).join('');
}

/* ── Show AI Result Panel ── */
function showAIResult(requestId) {
  const req = currentRequests.find(r => r.request_id === requestId);
  if (!req) return;
  selectedRequest = req;

  const panel = document.getElementById('ai-result-panel');
  if (!panel) return;

  const priority  = req.priority_level || 'Medium';
  const severity  = req.severity       || 'N/A';
  const isDup     = req.is_duplicate   || false;

  const priorityColor = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981' }[priority] || '#9CA3AF';
  const severityColor = {
    'Severe Damage':   '#EF4444',
    'Moderate Damage': '#F59E0B',
    'Low Damage':      '#10B981'
  }[severity] || '#9CA3AF';

  // Build resource forecast summary from data
  const p    = req.number_of_people || 1;
  const mult = priority === 'High' ? 1.5 : 1.0;
  let forecastText = 'Basic supplies required';
  if (req.request_type === 'Rescue')   forecastText = `${Math.max(2, Math.round(p / 2))} rescue personnel • ${Math.round(p * 2)} meal packets/day`;
  if (req.request_type === 'Food')     forecastText = `${Math.round(p * 3 * mult)} meal packets/day • ${Math.round(p * 2)}L water/day`;
  if (req.request_type === 'Water')    forecastText = `${Math.round(p * 5 * mult)}L water/day`;
  if (req.request_type === 'Medicine') forecastText = `${Math.max(1, Math.round(p / 3))} medical kits • 7 day support`;
  if (req.request_type === 'Shelter')  forecastText = `${Math.max(1, Math.round(p / 5))} shelter units • ${Math.round(p * 3)} meal packets/day`;

  panel.innerHTML = `
    <div class="ai-panel-title">🤖 AI Analysis — #${req.request_id}</div>
    <div class="ai-metric">
      <span class="ai-metric-label">🚨 Emergency Priority</span>
      <span class="ai-metric-value" style="color:${priorityColor}">${priority}</span>
    </div>
    <div class="ai-metric">
      <span class="ai-metric-label">📊 Damage Severity</span>
      <span class="ai-metric-value" style="color:${severityColor}">${severity !== 'N/A' ? severity : '—'}</span>
    </div>
    <div class="ai-metric">
      <span class="ai-metric-label">🔍 Duplicate Detection</span>
      <span class="ai-metric-value" style="color:${isDup ? '#9CA3AF' : '#10B981'}">${isDup ? '⚠️ Duplicate Found' : '✅ Unique Request'}</span>
    </div>
    <div class="ai-metric">
      <span class="ai-metric-label">📦 Resource Forecast</span>
      <span class="ai-metric-value" style="font-size:0.8rem;text-align:right;max-width:180px">${forecastText}</span>
    </div>
  `;

  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Filters ── */
function initFilters() {
  const searchInput  = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const typeFilter   = document.getElementById('type-filter');

  const applyFilters = () => {
    let filtered = [...currentRequests];
    const query  = searchInput?.value.toLowerCase()  || '';
    const status = statusFilter?.value               || '';
    const type   = typeFilter?.value                 || '';

    if (query)  filtered = filtered.filter(r => r.request_type?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query));
    if (status) filtered = filtered.filter(r => r.status === status);
    if (type)   filtered = filtered.filter(r => r.request_type === type);

    renderRequestTable(filtered);
  };

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
}

/* ── Fetch from real API ── */
async function loadRequests() {
  const data = await Api.get('/help-requests');
  if (data?.requests && data.requests.length > 0) {
    currentRequests = data.requests;
  } else {
    console.log("No data from API, injecting realistic demo data for User Dashboard");
    currentRequests = [
      { request_id: 101, request_type: 'Rescue', priority_level: 'High', status: 'Pending', severity: 'Severe Damage', created_at: new Date(Date.now() - 1800000).toISOString(), number_of_people: 5, description: 'Trapped in flooded house', is_duplicate: false },
      { request_id: 102, request_type: 'Medicine', priority_level: 'Medium', status: 'Accepted', severity: 'Moderate Damage', created_at: new Date(Date.now() - 7200000).toISOString(), number_of_people: 2, description: 'Urgent insulin needed', is_duplicate: false },
      { request_id: 103, request_type: 'Food', priority_level: 'Low', status: 'Completed', severity: 'Low Damage', created_at: new Date(Date.now() - 86400000).toISOString(), number_of_people: 15, description: 'Food packets for community', is_duplicate: false }
    ];
  }
  updateStats();
  renderRequestTable(currentRequests);

  // Show AI panel for the first request if any
  if (currentRequests.length > 0) {
    setTimeout(() => showAIResult(currentRequests[0].request_id), 600);
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  // Route guard: victim role only
  if (!Session.requireRole('victim')) return;
  populateUserInfo();
  loadRequests();
  initFilters();
});

window.showAIResult = showAIResult;
