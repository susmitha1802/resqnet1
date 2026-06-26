/**
 * ResQNet — Admin Dashboard Logic + Chart.js Charts
 * All data loaded from the real API via Api.get()
 */

let chartRequestsType = null;
let chartStatus = null;
let chartTrend = null;
let chartDisasters = null;
let allRequests = [];

/* ── Chart defaults ── */
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1A2035',
      borderColor: 'rgba(255,75,43,0.3)',
      borderWidth: 1,
      titleColor: '#F0F4FF',
      bodyColor: '#9CA3AF',
      padding: 12,
      cornerRadius: 8
    }
  }
};

/* ── Admin Section Switcher ── */
function showSection(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.style.display = 'none');
  const target = document.getElementById('section-' + name);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`[data-section="${name}"]`);
  if (activeLink) activeLink.classList.add('active');
}

/* ── Animate a single stat counter ── */
function animateStatCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let v = 0;
  const step = () => {
    v = Math.min(v + Math.ceil(Math.max(target, 1) / 20), target);
    el.textContent = v;
    if (v < target) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Load dashboard stats from API ── */
async function loadDashboard() {
  let data = await Api.get('/admin/dashboard');

  const s = data?.stats || {};
  animateStatCounter('stat-total', s.total_requests || 0);
  animateStatCounter('stat-high', s.high_priority || 0);
  animateStatCounter('stat-volunteers', s.active_volunteers || 0);
  animateStatCounter('stat-completed', s.completed || 0);
  animateStatCounter('stat-pending', s.pending || 0);
  animateStatCounter('stat-reports', s.disaster_reports || 0);

  // Real stat-change labels
  const total = s.total_requests || 0;
  const high = s.high_priority || 0;
  const vols = s.active_volunteers || 0;
  const completed = s.completed || 0;
  const pending = s.pending || 0;
  const reports = s.disaster_reports || 0;
  const dup = s.duplicate || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('stat-change-total', total > 0 ? `${total} total submitted` : 'No requests yet');
  set('stat-change-high', high > 0 ? `⚠️ ${high} need immediate action` : '✅ No critical cases');
  set('stat-change-volunteers', vols > 0 ? `${vols} available right now` : 'No volunteers online');
  set('stat-change-completed', completed > 0 ? `${pct}% resolution rate` : 'None completed yet');
  set('stat-change-pending', pending > 0 ? `${pending} awaiting assignment` : '✅ All assigned');
  set('stat-change-reports', reports > 0 ? `${reports} disaster reports filed` : 'No reports yet');

  // Volunteer summary panel
  const volSummary = document.getElementById('volunteer-summary');
  if (volSummary) {
    const total_v = s.total_volunteers || 0;
    const avail_v = s.active_volunteers || 0;
    const tasks_v = s.relief_tasks || 0;
    const busy_v = Math.max(0, total_v - avail_v);

    volSummary.innerHTML = [
      { label: 'Total Registered', val: total_v, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
      { label: 'Available Now', val: avail_v, color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
      { label: 'On Active Task', val: busy_v, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
      { label: 'Tasks Completed', val: tasks_v, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
    ].map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;
                  background:${item.bg};border-radius:var(--radius);border:1px solid ${item.border}">
        <div style="font-weight:600;font-size:0.875rem">${item.label}</div>
        <div style="font-size:1.4rem;font-weight:800;color:${item.color};font-family:'Space Grotesk',sans-serif">${item.val}</div>
      </div>
    `).join('');
  }
}

/* ── Load analytics + render charts ── */
async function loadAnalytics() {
  let data = await Api.get('/admin/analytics');

  const byType = data?.by_type || {};
  const byStatus = data?.by_status || {};
  const byPriority = data?.by_priority || {};
  const byDisaster = data?.by_disaster || {};
  const byDay = data?.by_day || [];

  // Predefined lists to ensure consistent categories and colors
  const DISASTER_TYPES = ['Flood', 'Cyclone', 'Earthquake', 'Landslide', 'Fire'];
  const REQUEST_TYPES = ['Rescue', 'Food', 'Water', 'Medicine', 'Shelter'];

  // 1. Bar — Requests by Type
  const barCtx = document.getElementById('chart-requests-type')?.getContext('2d');
  if (barCtx) {
    const labels = REQUEST_TYPES;
    const values = labels.map(l => byType[l] || 0);
    if (chartRequestsType) chartRequestsType.destroy();
    chartRequestsType = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(245,158,11,0.7)', 'rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(139,92,246,0.7)'],
          borderColor: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'],
          borderWidth: 2, borderRadius: 8, borderSkipped: false,
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' }, beginAtZero: true, suggestedMax: 5 }
        }
      }
    });
  }

  // 2. Doughnut — Status Distribution
  const donutCtx = document.getElementById('chart-status')?.getContext('2d');
  if (donutCtx) {
    const labels = ['Pending', 'Accepted', 'En Route', 'On Site', 'Completed'];
    const values = labels.map(l => byStatus[l] || 0);
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(59,130,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(139,92,246,0.7)', 'rgba(16,185,129,0.7)'],
          borderColor: ['#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#10B981'],
          borderWidth: 2, hoverOffset: 8,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, position: 'bottom', labels: { color: '#9CA3AF', padding: 12, usePointStyle: true, pointStyleWidth: 10 } }
        },
        cutout: '70%',
      }
    });
  }

  // 3. Line — Weekly Trend (last 7 days from by_day)
  const lineCtx = document.getElementById('chart-trend')?.getContext('2d');
  if (lineCtx) {
    const labels = byDay.map(d => d.day?.slice(5) || d.day); // MM-DD
    const requests = byDay.map(d => d.count);
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'New Requests',
          data: requests,
          borderColor: '#FF4B2B',
          backgroundColor: 'rgba(255,75,43,0.1)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#FF4B2B',
          pointBorderColor: '#FF4B2B',
          pointRadius: 5,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, position: 'top', labels: { color: '#9CA3AF', padding: 16, usePointStyle: true, pointStyleWidth: 10 } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' }, beginAtZero: true, suggestedMax: 5 }
        }
      }
    });
  }

  // 4. Polar — Disaster types
  const polarCtx = document.getElementById('chart-disasters')?.getContext('2d');
  if (polarCtx) {
    const labels = DISASTER_TYPES;
    const values = labels.map(l => byDisaster[l] || 0);
    if (chartDisasters) chartDisasters.destroy();
    chartDisasters = new Chart(polarCtx, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
          borderColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'],
          borderWidth: 2
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, position: 'bottom', labels: { color: '#9CA3AF', padding: 10, usePointStyle: true, pointStyleWidth: 10 } }
        },
        scales: { r: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9CA3AF', backdropColor: 'transparent', stepSize: 1 } } }
      }
    });
  }
}

/* ── Load & Render Requests Table ── */
async function loadRequests() {
  const data = await Api.get('/admin/requests');
  let requests = data?.requests || [];

  allRequests = requests;
  renderRequestsTable(allRequests);
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;

  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No requests yet</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td><span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">#${r.request_id}</span></td>
      <td style="font-weight:600">${r.name}</td>
      <td>${r.request_type}</td>
      <td>${priorityBadge(r.priority_level)}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="color:var(--text-secondary);font-size:0.82rem">${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}</td>
      <td style="color:var(--text-muted);font-size:0.78rem">${timeAgo(r.created_at)}</td>
      <td>${r.number_of_people}</td>
    </tr>
  `).join('');
}

/* ── Fetch Disaster Reports ── */
async function loadDisasters() {
  try {
    const data = await Api.get('/reports');
    const reports = data?.reports || [];
    const tbody = document.getElementById('disasters-tbody');
    if (!tbody) return;

    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">No disaster reports found.</td></tr>';
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr style="${r.ai_mismatch ? 'background:rgba(239,68,68,0.04);border-left:3px solid #EF4444' : ''}">
        <td style="font-weight:600">#${r.report_id}</td>
        <td>${r.user_name || 'User ' + r.user_id}</td>
        <td>
          🔥 ${r.disaster_type}
          ${r.ai_mismatch ? `<br><span title="CNN predicted a different disaster type" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,0.15);color:#EF4444;font-size:0.7rem;font-weight:700;border:1px solid rgba(239,68,68,0.3);">⚠️ AI Mismatch</span>` : ''}
        </td>
        <td>
          <span class="priority-badge" style="
            background:${r.severity.includes('Severe') ? 'rgba(239,68,68,0.2)' : (r.severity.includes('Moderate') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)')};
            color:${r.severity.includes('Severe') ? '#EF4444' : (r.severity.includes('Moderate') ? '#F59E0B' : '#10B981')}
          ">${r.severity}</span>
        </td>
        <td style="color:var(--text-secondary)">📍 ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}</td>
        <td>
          <div style="font-size:0.75rem;line-height:1.4">
            <strong>${r.predicted_disaster_type || 'Unknown'}</strong><br>
            <span style="color:var(--text-muted)">${(r.prediction_confidence !== null && r.prediction_confidence !== undefined) ? r.prediction_confidence + '%' : 'N/A'}</span>
            ${r.ai_mismatch ? `<br><span style="color:#F59E0B;font-size:0.7rem">Reported: ${r.disaster_type}</span>` : ''}
          </div>
        </td>
        <td style="color:var(--text-secondary)">${new Date(r.created_at).toLocaleString()}</td>
        <td>
          <a href="map.html?report_id=${r.report_id}" class="btn-resq-outline" style="padding:5px 12px;font-size:0.75rem">🗺️ Map</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load disasters:', err);
  }
}

/* ── Fetch Contact Messages ── */
async function loadContactMessages() {
  try {
    const data = await Api.get('/admin/contact-messages');
    const messages = data?.messages || [];

    // Update KPI
    const unreadCount = messages.filter(m => m.status === 'Unread').length;
    const statSupport = document.getElementById('stat-support-messages');
    const changeSupport = document.getElementById('stat-change-support-messages');
    if (statSupport) statSupport.textContent = messages.length;
    if (changeSupport) {
      changeSupport.textContent = `${unreadCount} unread`;
      changeSupport.className = `stat-change ${unreadCount > 0 ? 'down' : 'up'}`;
    }

    const tbody = document.getElementById('support-messages-tbody');
    if (!tbody) return;

    if (messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">No support messages found.</td></tr>';
      return;
    }

    tbody.innerHTML = messages.map(m => `
      <tr>
        <td style="font-weight:600">${m.name}</td>
        <td><a href="mailto:${m.email}">${m.email}</a></td>
        <td style="max-width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap">${m.subject}</td>
        <td style="max-width:300px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="${m.message.replace(/"/g, '&quot;')}">${m.message}</td>
        <td style="color:var(--text-secondary)">${new Date(m.created_at).toLocaleString()}</td>
        <td>
          <span class="badge-${m.status === 'Unread' ? 'danger' : 'success'}">${m.status}</span>
        </td>
        <td>
          <div style="display:flex;gap:8px">
            ${m.status === 'Unread' ? `<button class="btn-resq-outline" style="padding:4px 8px;font-size:0.75rem" onclick="markContactMessageRead(${m.id})">Mark Read</button>` : ''}
            <button class="btn-resq-outline" style="padding:4px 8px;font-size:0.75rem;color:#EF4444;border-color:rgba(239,68,68,0.2)" onclick="deleteContactMessage(${m.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load contact messages:', err);
  }
}

async function markContactMessageRead(id) {
  try {
    const data = await Api.put('/admin/contact-messages/' + id + '/read');
    if (data?.success) {
      Toast.show('Message marked as read', 'success');
      loadContactMessages();
    } else {
      Toast.show(data?.message || 'Failed to mark as read', 'danger');
    }
  } catch (err) {
    console.error(err);
    Toast.show('Failed to mark as read', 'danger');
  }
}

async function deleteContactMessage(id) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  try {
    const data = await Api.delete('/admin/contact-messages/' + id);
    if (data?.success) {
      Toast.show('Message deleted', 'success');
      loadContactMessages();
    } else {
      Toast.show(data?.message || 'Failed to delete message', 'danger');
    }
  } catch (err) {
    console.error(err);
    Toast.show('Failed to delete message', 'danger');
  }
}

/* ── Load Pending Verifications ── */
async function loadVerifications() {
  const tbody = document.getElementById('verifications-tbody');
  if (!tbody) return;
  const data = await Api.get('/admin/pending-verifications');
  if (!data?.success) return;
  const vs = data.verifications || [];
  if (!vs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">No pending verifications.</td></tr>`;
    return;
  }
  tbody.innerHTML = vs.map(v => `
    <tr>
      <td>#${v.task_id}</td>
      <td>Volunteer #${v.volunteer_id}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v.completion_notes || ''}">
        ${v.completion_notes || '<span style="color:var(--text-muted)">No notes</span>'}
      </td>
      <td>
        <a href="${Api.BASE}${v.proof_image_path}" target="_blank" style="color:var(--primary);text-decoration:underline;">View Image</a>
      </td>
      <td><span class="badge-pending">⏳ Pending</span></td>
      <td>
        <div style="display:flex;gap:8px;">
          <button class="btn-resq-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="reviewTask(${v.task_id}, 'Approve')">Approve</button>
          <button class="btn-resq-outline" style="padding:4px 10px;font-size:0.75rem;border-color:var(--danger);color:var(--danger);" onclick="reviewTask(${v.task_id}, 'Reject')">Reject</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── Review Task ── */
async function reviewTask(taskId, action) {
  if (!confirm(`Are you sure you want to ${action} this task proof?`)) return;
  const data = await Api.put(`/admin/verify-task/${taskId}`, { action });
  if (data?.success) {
    Toast.show(`Task ${action.toLowerCase()}d!`, 'success');
    loadVerifications();
    loadDashboard();
  } else {
    Toast.show(data?.message || `Failed to ${action} task`, 'danger');
  }
}

/* ── Filters ── */
function initFilters() {
  const search = document.getElementById('search-input');
  const priority = document.getElementById('priority-filter');
  const status = document.getElementById('status-filter');

  const apply = () => {
    let filtered = [...allRequests];
    const q = search?.value.toLowerCase() || '';
    const p = priority?.value || '';
    const s = status?.value || '';
    if (q) filtered = filtered.filter(r => r.name?.toLowerCase().includes(q) || r.request_type?.toLowerCase().includes(q) || String(r.request_id).includes(q));
    if (p) filtered = filtered.filter(r => r.priority_level === p);
    if (s) filtered = filtered.filter(r => r.status === s);
    renderRequestsTable(filtered);
  };

  search?.addEventListener('input', apply);
  priority?.addEventListener('change', apply);
  status?.addEventListener('change', apply);
}

/* ── Populate admin info ── */
function populateAdminInfo() {
  const user = Session.get() || { name: 'Admin Officer', role: 'admin' };
  const name = user.name || 'Admin';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avEl = document.getElementById('sidebar-avatar');
  if (avEl) avEl.textContent = initials;
  const unEl = document.getElementById('sidebar-username');
  if (unEl) unEl.textContent = name;
  const urEl = document.getElementById('sidebar-userrole');
  if (urEl) urEl.textContent = 'Administrator';
}

/* ── Live Clock ── */
function startClock() {
  const el = document.getElementById('eoc-clock');
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  };
  update();
  setInterval(update, 1000);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  // Route guard: admin role only
  if (!Session.requireRole('admin')) return;
  populateAdminInfo();
  startClock();
  await Promise.all([
    loadDashboard(),
    loadAnalytics(),
    loadRequests(),
    loadDisasters(),
    loadContactMessages(),
    loadVerifications(),
    loadAlerts(),
    loadWeather(),
    loadPreparednessData()
  ]);
  initFilters();
});

/* ── Weather Alerts ── */
async function loadAlerts() {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/alerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    renderAlerts(data.alerts || []);
  } catch (e) {
    document.getElementById('alerts-list').innerHTML = '<p style="color:var(--danger)">Failed to load alerts</p>';
  }
}

function renderAlerts(alerts) {
  const container = document.getElementById('alerts-list');
  if (!alerts.length) {
    container.innerHTML = '<p style="color:var(--text-muted)">No active alerts</p>';
    return;
  }
  const severityColor = { Watch: '#f59e0b', Warning: '#ef4444', Emergency: '#7c3aed' };
  const icons = { Cyclone: '🌀', Flood: '🌊', Storm: '⛈', Heatwave: '🔥', Earthquake: '🌍', Other: '⚠' };
  container.innerHTML = alerts.map(a => `
    <div style="border:1px solid var(--border-glass);border-radius:var(--radius);padding:16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <span style="font-size:1.4rem">${icons[a.alert_type] || '⚠'}</span>
        <strong style="margin-left:8px">${a.alert_type} ${a.alert_type === 'Other' ? '' : ''}</strong>
        <span style="margin-left:10px;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;background:${severityColor[a.severity]}22;color:${severityColor[a.severity]}">${a.severity}</span>
        <div style="color:var(--text-muted);font-size:0.83rem;margin-top:4px">${a.description}</div>
        <div style="color:var(--text-muted);font-size:0.78rem;margin-top:2px">Radius: ${a.affected_radius_km}km · ${new Date(a.issued_at).toLocaleString()}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-resq" style="padding:6px 14px;font-size:0.82rem" onclick="notifyAll(${a.alert_id})">📣 Notify All</button>
        <button class="btn-resq-outline" style="padding:6px 14px;font-size:0.82rem" onclick="viewResponses(${a.alert_id})">View Responses</button>
      </div>
    </div>
  `).join('');
}

async function notifyAll(alertId) {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/notify`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      Toast.show(`Pings sent to ${data.pings_sent} responders in zone`, 'success');
    } else {
      Toast.show(data.message || 'Failed to send pings', 'danger');
    }
  } catch (e) {
    Toast.show('Error connecting to notification service', 'danger');
  }
}

async function viewResponses(alertId) {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/responses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      const responses = data.responses || [];
      const summary = responses.map(p => `${p.user_name} (${p.status})`).join(' | ') || 'No responses yet';
      Toast.show(summary, 'info', 6000);
    } else {
      Toast.show(data.message || 'Failed to load responses', 'danger');
    }
  } catch (e) {
    Toast.show('Error loading responses', 'danger');
  }
}

async function fetchOWMAlert(e) {
  const token = Session.getToken();
  const btn = e ? e.target : document.querySelector('button[onclick*="fetchOWMAlert"]');
  if (btn) {
    btn.textContent = 'Fetching...';
    btn.disabled = true;
  }
  try {
    const loc = await getActiveLocation();
    const lat = loc ? loc.lat : 17.6868;
    const lng = loc ? loc.lng : 83.2185;

    const res = await fetch(`${API_BASE}/alerts/fetch?lat=${lat}&lng=${lng}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadAlerts();
      await loadWeather();
      await loadPreparednessData();
      Toast.show('Weather & alerts refreshed', 'success');
      if (btn) btn.textContent = '✓ Fetched';
    } else {
      Toast.show(data.message || 'Weather service unavailable', 'danger');
      if (btn) btn.textContent = '✗ Failed';
    }
  } catch (e) {
    Toast.show('Error connecting to weather service', 'danger');
    if (btn) btn.textContent = '✗ Error';
  }
  setTimeout(() => { if (btn) { btn.textContent = '🔄 Refresh OWM'; btn.disabled = false; } }, 2000);
}

function showCreateAlertModal() {
  document.getElementById('create-alert-modal').style.display = 'flex';
}

function closeCreateAlertModal() {
  document.getElementById('create-alert-modal').style.display = 'none';
}

async function submitManualAlert() {
  const token = Session.getToken();
  const body = {
    alert_type: document.getElementById('modal-alert-type').value,
    severity: document.getElementById('modal-severity').value,
    description: document.getElementById('modal-description').value,
    affected_lat: parseFloat(document.getElementById('modal-lat').value) || 0,
    affected_lng: parseFloat(document.getElementById('modal-lng').value) || 0,
    affected_radius_km: parseInt(document.getElementById('modal-radius').value) || 50,
  };
  const res = await fetch(`${API_BASE}/alerts`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.success) {
    closeCreateAlertModal();
    await loadAlerts();
  }
}

/* ── Live Weather — uses real user/admin location ── */
async function loadWeather() {
  const loc = await getActiveLocation();
  if (!loc) {
    const mainEl = document.getElementById('weather-current-main');
    if (mainEl) mainEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">📍 Enable location access to load weather</span>';
    return;
  }
  try {
    const data = await Api.get(`/weather/live?lat=${loc.lat}&lng=${loc.lng}`);
    if (!data?.success || !data.current) throw new Error(data?.message || 'No data');
    const cur = data.current;

    const iconCode = cur.weather[0].icon;
    const temp = Math.round(cur.main.temp);
    const desc = cur.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
    const humidity = cur.main.humidity;
    const pressure = cur.main.pressure;
    const wind = cur.wind.speed;
    const visibility = cur.visibility ? (cur.visibility / 1000).toFixed(1) : '--';

    const mainEl = document.getElementById('weather-current-main');
    if (mainEl) mainEl.innerHTML = `
      <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" width="60" style="filter:drop-shadow(0 0 8px rgba(255,200,50,0.5))" />
      <div>
        <div class="eoc-weather-temp">${temp}°C</div>
        <div class="eoc-weather-desc" id="weather-current-desc">${desc}</div>
      </div>
    `;

    const metricsEl = document.getElementById('weather-current-metrics');
    if (metricsEl) metricsEl.innerHTML = `
      <div class="eoc-weather-stat"><span class="eoc-weather-stat-label">Humidity</span><span class="eoc-weather-stat-val">${humidity}%</span></div>
      <div class="eoc-weather-stat"><span class="eoc-weather-stat-label">Wind</span><span class="eoc-weather-stat-val">${wind} m/s</span></div>
      <div class="eoc-weather-stat"><span class="eoc-weather-stat-label">Pressure</span><span class="eoc-weather-stat-val">${pressure} hPa</span></div>
      <div class="eoc-weather-stat"><span class="eoc-weather-stat-label">Visibility</span><span class="eoc-weather-stat-val">${visibility} km</span></div>
    `;

    // Update Preparedness Highlights if present
    const prepEl = document.getElementById('prep-weather-metrics');
    if (prepEl) prepEl.innerHTML = `
      <div class="prep-stat-box"><div class="prep-stat-val">${temp}°C</div><div class="prep-stat-lbl">Temperature</div></div>
      <div class="prep-stat-box"><div class="prep-stat-val">${wind}</div><div class="prep-stat-lbl">Wind (m/s)</div></div>
      <div class="prep-stat-box"><div class="prep-stat-val">${cur.rain ? (cur.rain['1h'] || 0) : 0}</div><div class="prep-stat-lbl">Rain (mm)</div></div>
    `;
  } catch (e) { 
    console.error('Failed to load weather', e); 
    const descEl = document.getElementById('weather-current-desc');
    if (descEl) {
      descEl.textContent = 'Failed to load data';
      descEl.style.color = 'var(--accent-red)';
    } else {
      const mainEl = document.getElementById('weather-current-main');
      if (mainEl) mainEl.innerHTML = '<span style="color:var(--accent-red);font-size:0.85rem">Failed to load weather</span>';
    }
  }
}

/* ── Preparedness Data ── */
async function loadPreparednessData() {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/preparedness/summary`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    if (!res.ok) return; // silently skip if endpoint doesn't exist
    const data = await res.json();
    if (data.success) {
      const vEl = document.getElementById('prep-vol-ready');
      const nEl = document.getElementById('prep-ngo-ready');
      if (vEl) vEl.textContent = `🟢 ${data.volunteers?.ready || 0} Volunteers Ready`;
      if (nEl) nEl.textContent = `🟢 ${data.ngos?.ready || 0} NGOs Available`;
    }
  } catch(e) { /* silent fail */ }
}

const originalRenderAlerts = renderAlerts;
renderAlerts = function (alerts) {
  originalRenderAlerts(alerts);
  // Also render into Prep center
  const prepList = document.getElementById('prep-alerts-list');
  const highlight = document.getElementById('prep-alert-highlight');

  if (!alerts.length) {
    if (prepList) prepList.innerHTML = '<p style="color:var(--text-muted)">No active alerts.</p>';
    if (highlight) highlight.innerHTML = '<p style="color:var(--accent-green);font-weight:600;font-size:1.1rem">🟢 Conditions Safe</p>';
    return;
  }

  const topAlert = alerts[0];
  if (highlight) highlight.innerHTML = `<p style="color:var(--accent-red);font-weight:600;font-size:1.1rem">🔴 ${topAlert.alert_type} ${topAlert.severity}</p><p style="color:var(--text-secondary);font-size:0.9rem">${topAlert.description}</p>`;

  if (prepList) prepList.innerHTML = alerts.map(a => `
    <div class="alert-card ${a.severity === 'Emergency' || a.severity === 'Warning' ? 'high' : ''}">
      <div style="font-weight:700;font-size:1.1rem">⚠ ${a.alert_type} ${a.severity}</div>
      <div style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:8px">${a.description}</div>
      <div class="alert-card-grid">
        <div><strong>Radius:</strong> ${a.affected_radius_km} km</div>
        <div><strong>Status:</strong> Active</div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-resq" style="padding:6px 14px;font-size:0.82rem" onclick="notifyAll(${a.alert_id})">📣 Notify Responders</button>
      </div>
    </div>
  `).join('');
};

async function notifyAllResponders(type) {
  const token = Session.getToken();
  try {
    const alertsRes = await fetch(`${API_BASE}/alerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const alertsData = await alertsRes.json();
    const alerts = alertsData.alerts || [];
    if (!alerts.length) {
      Toast.show('No active alerts to notify about', 'warning');
      return;
    }
    let totalPings = 0;
    for (const alert of alerts) {
      const res = await fetch(`${API_BASE}/alerts/${alert.alert_id}/notify`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      totalPings += data.pings_sent || 0;
    }
    Toast.show(`✅ ${totalPings} ${type === 'volunteer' ? 'volunteers' : 'NGOs'} notified successfully`, 'success');
  } catch (e) {
    Toast.show('Failed to send notifications', 'danger');
  }
}
