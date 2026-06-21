/**
 * ResQNet — Admin Dashboard Logic + Chart.js Charts
 * All data loaded from the real API via Api.get()
 */

let chartRequestsType = null;
let chartStatus       = null;
let chartTrend        = null;
let chartDisasters    = null;
let allRequests       = [];

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

  const s = data.stats || {};
  animateStatCounter('stat-total',      s.total_requests    || 0);
  animateStatCounter('stat-high',       s.high_priority     || 0);
  animateStatCounter('stat-volunteers', s.active_volunteers || 0);
  animateStatCounter('stat-completed',  s.completed         || 0);
  animateStatCounter('stat-pending',    s.pending           || 0);
  animateStatCounter('stat-reports',    s.disaster_reports  || 0);

  // Real stat-change labels
  const total    = s.total_requests    || 0;
  const high     = s.high_priority     || 0;
  const vols     = s.active_volunteers || 0;
  const completed = s.completed        || 0;
  const pending  = s.pending           || 0;
  const reports  = s.disaster_reports  || 0;
  const dup      = s.duplicate         || 0;
  const pct      = total > 0 ? Math.round((completed / total) * 100) : 0;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('stat-change-total',     total     > 0 ? `${total} total submitted`          : 'No requests yet');
  set('stat-change-high',      high      > 0 ? `⚠️ ${high} need immediate action`  : '✅ No critical cases');
  set('stat-change-volunteers',vols      > 0 ? `${vols} available right now`       : 'No volunteers online');
  set('stat-change-completed', completed > 0 ? `${pct}% resolution rate`           : 'None completed yet');
  set('stat-change-pending',   pending   > 0 ? `${pending} awaiting assignment`    : '✅ All assigned');
  set('stat-change-reports',   reports   > 0 ? `${reports} disaster reports filed` : 'No reports yet');

  // Volunteer summary panel
  const volSummary = document.getElementById('volunteer-summary');
  if (volSummary) {
    const total_v = s.total_volunteers  || 0;
    const avail_v = s.active_volunteers || 0;
    const tasks_v = s.relief_tasks      || 0;
    const busy_v  = Math.max(0, total_v - avail_v);

    volSummary.innerHTML = [
      { label: 'Total Registered', val: total_v,  color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.15)' },
      { label: 'Available Now',    val: avail_v,  color: '#10B981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.15)' },
      { label: 'On Active Task',   val: busy_v,   color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
      { label: 'Tasks Completed',  val: tasks_v,  color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
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

  const byType     = data.by_type     || {};
  const byStatus   = data.by_status   || {};
  const byPriority = data.by_priority || {};
  const byDisaster = data.by_disaster || {};
  const byDay      = data.by_day      || [];

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
          backgroundColor: ['rgba(239,68,68,0.7)','rgba(245,158,11,0.7)','rgba(59,130,246,0.7)','rgba(16,185,129,0.7)','rgba(139,92,246,0.7)'],
          borderColor:      ['#EF4444','#F59E0B','#3B82F6','#10B981','#8B5CF6'],
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
          borderColor:      ['#EF4444',             '#3B82F6',             '#F59E0B',             '#8B5CF6',              '#10B981'],
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
    const labels   = byDay.map(d => d.day?.slice(5) || d.day); // MM-DD
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
          backgroundColor: ['rgba(59,130,246,0.7)','rgba(139,92,246,0.7)','rgba(16,185,129,0.7)','rgba(245,158,11,0.7)','rgba(239,68,68,0.7)'],
          borderColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444'],
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

/* ── Resource Distribution Bars — loaded from forecast ── */
function renderDistributionBars(requests) {
  // Aggregate forecasted resources from all pending/accepted requests
  let food = 0, water = 0, medical = 0, rescue = 0, shelter = 0;
  requests.forEach(r => {
    // Estimate from priority
    const mult = r.priority_level === 'High' ? 1.5 : 1.0;
    const p    = r.number_of_people || 1;
    if (r.request_type === 'Food')     { food   += Math.round(p * 3 * mult); water += Math.round(p * 2); }
    if (r.request_type === 'Water')    { water  += Math.round(p * 5 * mult); }
    if (r.request_type === 'Medicine') { medical += Math.max(1, Math.round(p / 3)); }
    if (r.request_type === 'Rescue')   { rescue  += Math.max(2, Math.round(p / 2)); medical += Math.max(1, Math.round(p / 5)); }
    if (r.request_type === 'Shelter')  { shelter += Math.max(1, Math.round(p / 5)); }
  });

  const items = [
    { label: 'Food Packets',   value: food,    max: Math.max(food * 2, 50),    color: '#F59E0B' },
    { label: 'Water (Litres)', value: water,   max: Math.max(water * 2, 100),  color: '#3B82F6' },
    { label: 'Medical Kits',   value: medical, max: Math.max(medical * 2, 10), color: '#10B981' },
    { label: 'Rescue Teams',   value: rescue,  max: Math.max(rescue * 2, 5),   color: '#EF4444' },
    { label: 'Shelter Units',  value: shelter, max: Math.max(shelter * 2, 5),  color: '#8B5CF6' },
  ];

  const container = document.getElementById('distribution-bars');
  if (!container) return;
  container.innerHTML = items.map(item => `
    <div class="distribution-bar">
      <div class="distribution-label">
        <span>${item.label}</span>
        <span>${item.value.toLocaleString()} needed</span>
      </div>
      <div class="distribution-track">
        <div class="distribution-fill" data-width="${Math.min(Math.round(item.value / item.max * 100), 100)}" style="background:${item.color};width:0%"></div>
      </div>
    </div>
  `).join('');

  setTimeout(() => {
    container.querySelectorAll('.distribution-fill').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });
  }, 300);
}

/* ── Load & Render Requests Table ── */
async function loadRequests() {
  const data = await Api.get('/admin/requests');
  let requests = data?.requests || [];
  
  allRequests = requests;
  renderRequestsTable(allRequests);
  renderDistributionBars(allRequests.filter(r => ['Pending','Accepted'].includes(r.status)));
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
    const reports = data.reports || [];
    const tbody = document.getElementById('disasters-tbody');
    if (!tbody) return;

    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">No disaster reports found.</td></tr>';
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td style="font-weight:600">#${r.report_id}</td>
        <td>${r.user_name || 'User ' + r.user_id}</td>
        <td>🔥 ${r.disaster_type}</td>
        <td>
          <span class="priority-badge" style="
            background:${r.severity.includes('Severe') ? 'rgba(239,68,68,0.2)' : (r.severity.includes('Moderate') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)')};
            color:${r.severity.includes('Severe') ? '#EF4444' : (r.severity.includes('Moderate') ? '#F59E0B' : '#10B981')}
          ">${r.severity}</span>
        </td>
        <td style="color:var(--text-secondary)">📍 ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}</td>
        <td>
          <div style="font-size:0.75rem;line-height:1.2">
            <strong>${r.predicted_disaster_type || 'Unknown'}</strong><br>
            <span style="color:var(--text-muted)">${(r.prediction_confidence !== null && r.prediction_confidence !== undefined) ? r.prediction_confidence + '%' : 'N/A'}</span>
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
    const messages = data.messages || [];
    
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
    if (data.success) {
      Toast.show('Message marked as read', 'success');
      loadContactMessages();
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
    if (data.success) {
      Toast.show('Message deleted', 'success');
      loadContactMessages();
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
        <a href="http://127.0.0.1:5000${v.proof_image_path}" target="_blank" style="color:var(--primary);text-decoration:underline;">View Image</a>
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
  const search   = document.getElementById('search-input');
  const priority = document.getElementById('priority-filter');
  const status   = document.getElementById('status-filter');

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

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  // Route guard: admin role only
  if (!Session.requireRole('admin')) return;
  populateAdminInfo();
  await Promise.all([loadDashboard(), loadAnalytics(), loadRequests(), loadDisasters(), loadContactMessages(), loadVerifications()]);
  initFilters();
});
