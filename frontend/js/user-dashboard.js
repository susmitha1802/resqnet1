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
  if (urEl) urEl.textContent = 'Disaster Reporter';
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
      </td>
    </tr>
  `).join('');
}

/* ── Render Timeline ── */
function renderTimeline(requests) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  if (!requests.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px">No requests to track.</div>`;
    return;
  }

  const steps = ['Pending', 'Accepted', 'In Progress', 'Completed'];

  container.innerHTML = requests.map(r => {
    let currentStep = 0;
    if (r.status === 'Accepted') currentStep = 1;
    if (r.status === 'En Route' || r.status === 'On Site') currentStep = 2;
    if (r.status === 'Completed' || r.status === 'Duplicate') currentStep = 3;

    const timelineHtml = steps.map((step, idx) => {
      const isPast = idx < currentStep;
      const isCurrent = idx === currentStep;
      const color = isPast || isCurrent ? 'var(--primary)' : 'var(--bg-glass)';
      const textCol = isPast || isCurrent ? 'var(--text-primary)' : 'var(--text-muted)';
      const fw = isCurrent ? '700' : '500';
      return `
        <div style="flex:1;text-align:center;position:relative">
          <div style="height:4px;background:${color};margin-bottom:8px;border-radius:2px;box-shadow: ${isCurrent ? '0 0 10px var(--primary)' : 'none'}"></div>
          <div style="font-size:0.75rem;color:${textCol};font-weight:${fw}">${step}</div>
        </div>
      `;
    }).join('');

    const assignedTo = r.assigned_volunteer ? `🧑‍🤝‍🧑 Assigned to: <strong>${r.assigned_volunteer}</strong>` : `⏳ Waiting for volunteer`;
    
    return `
      <div style="border:1px solid var(--border-glass);border-radius:var(--radius);padding:16px;background:var(--bg-card-2);cursor:pointer;transition:var(--transition);" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-glass)'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:8px">
              ${r.request_type} Request <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;font-family:monospace">#${r.request_id}</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">
              Last updated: ${timeAgo(r.updated_at || r.created_at)} • ${assignedTo}
            </div>
          </div>
          ${statusBadge(r.status)}
        </div>
        <div style="display:flex;gap:4px">
          ${timelineHtml}
        </div>
      </div>
    `;
  }).join('');
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
    renderTimeline(filtered);
  };

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
}

/* ── Fetch from real API ── */
async function loadRequests() {
  const data = await Api.get('/help-requests');
  currentRequests = data?.requests || [];

  updateStats();
  renderRequestTable(currentRequests);
  renderTimeline(currentRequests);
}

/* ── Fetch Disaster Reports ── */
async function loadDisasters() {
  const data = await Api.get('/reports');
  const user = Session.get();
  if (!user) return;

  const myReports = (data.reports || []).filter(r => r.user_id === user.user_id);
  const tbody = document.getElementById('disasters-tbody');
  
  if (!tbody) return;

  if (myReports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">You have not reported any disasters.</td></tr>';
    return;
  }

  tbody.innerHTML = myReports.map(r => `
    <tr>
      <td style="font-weight:600">🔥 ${r.disaster_type}</td>
      <td>
        <span class="priority-badge" style="
          background:${r.severity.includes('Severe') ? 'rgba(239,68,68,0.2)' : (r.severity.includes('Moderate') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)')};
          color:${r.severity.includes('Severe') ? '#EF4444' : (r.severity.includes('Moderate') ? '#F59E0B' : '#10B981')}
        ">${r.severity}</span>
      </td>
      <td style="color:var(--text-secondary)">📍 ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</td>
      <td>
        <div style="font-size:0.75rem;line-height:1.2">
          <strong>${r.predicted_disaster_type || 'Unknown'}</strong><br>
          <span style="color:var(--text-muted)">${r.prediction_confidence ? r.prediction_confidence + '%' : 'N/A'}</span>
        </div>
      </td>
      <td style="color:var(--text-secondary)">${timeAgo(r.created_at)}</td>
      <td>
        <a href="map.html?report_id=${r.report_id}" class="btn-resq-outline" style="padding:5px 12px;font-size:0.75rem">🗺️ View On Map</a>
      </td>
    </tr>
  `).join('');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  // Route guard: reporter role only
  if (!Session.requireRole('reporter')) return;
  populateUserInfo();
  loadRequests();
  loadDisasters();
  initFilters();
});
