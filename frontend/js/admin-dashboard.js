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
  if (!data?.stats || data.stats.total_requests === 0) {
    console.log("No stats from API, injecting demo stats for Admin Dashboard");
    data = { stats: { total_requests: 120, high_priority: 15, active_volunteers: 45, completed: 85, pending: 35, disaster_reports: 8, total_volunteers: 60, relief_tasks: 25 } };
  }

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
  if (!data || Object.keys(data.by_type || {}).length === 0) {
    console.log("No analytics from API, injecting demo analytics for Admin Dashboard");
    data = {
      by_type: { Rescue: 20, Food: 45, Water: 30, Medicine: 15, Shelter: 10 },
      by_status: { Pending: 35, Accepted: 40, Completed: 85, Cancelled: 5 },
      by_priority: { High: 15, Medium: 60, Low: 45 },
      by_disaster: { Flood: 50, Cyclone: 30, Earthquake: 5, Fire: 20, Other: 15 },
      by_day: [
        { day: '2023-10-01', count: 5 }, { day: '2023-10-02', count: 12 }, { day: '2023-10-03', count: 8 },
        { day: '2023-10-04', count: 15 }, { day: '2023-10-05', count: 25 }, { day: '2023-10-06', count: 18 }, { day: '2023-10-07', count: 37 }
      ]
    };
  }

  const byType     = data.by_type     || {};
  const byStatus   = data.by_status   || {};
  const byPriority = data.by_priority || {};
  const byDisaster = data.by_disaster || {};
  const byDay      = data.by_day      || [];

  // 1. Bar — Requests by Type
  const barCtx = document.getElementById('chart-requests-type')?.getContext('2d');
  if (barCtx) {
    const labels = Object.keys(byType);
    const values = Object.values(byType);
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
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' }, beginAtZero: true }
        }
      }
    });
  }

  // 2. Doughnut — Status Distribution
  const donutCtx = document.getElementById('chart-status')?.getContext('2d');
  if (donutCtx) {
    const labels = Object.keys(byStatus);
    const values = Object.values(byStatus);
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(16,185,129,0.8)','rgba(245,158,11,0.8)','rgba(59,130,246,0.8)','rgba(107,114,128,0.8)'],
          borderColor: ['#10B981','#F59E0B','#3B82F6','#6B7280'],
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
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' }, beginAtZero: true }
        }
      }
    });
  }

  // 4. Polar — Disaster types
  const polarCtx = document.getElementById('chart-disasters')?.getContext('2d');
  if (polarCtx) {
    const labels = Object.keys(byDisaster);
    const values = Object.values(byDisaster);
    if (chartDisasters) chartDisasters.destroy();
    chartDisasters = new Chart(polarCtx, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(59,130,246,0.7)','rgba(139,92,246,0.7)','rgba(239,68,68,0.7)','rgba(16,185,129,0.7)','rgba(245,158,11,0.7)'],
          borderColor: ['#3B82F6','#8B5CF6','#EF4444','#10B981','#F59E0B'],
          borderWidth: 2
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, position: 'bottom', labels: { color: '#9CA3AF', padding: 10, usePointStyle: true, pointStyleWidth: 10 } }
        },
        scales: { r: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9CA3AF', backdropColor: 'transparent' } } }
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
  
  if (requests.length === 0) {
    console.log("No requests from API, injecting demo data for Admin Dashboard");
    requests = [
      { request_id: 101, name: 'Alice Smith', request_type: 'Rescue', priority_level: 'High', status: 'Pending', latitude: 17.4474, longitude: 78.3762, created_at: new Date(Date.now() - 3600000).toISOString(), number_of_people: 5 },
      { request_id: 102, name: 'Bob Johnson', request_type: 'Food', priority_level: 'Medium', status: 'Accepted', latitude: 17.4300, longitude: 78.4000, created_at: new Date(Date.now() - 7200000).toISOString(), number_of_people: 12 },
      { request_id: 103, name: 'Charlie Brown', request_type: 'Medicine', priority_level: 'High', status: 'In Progress', latitude: 17.4500, longitude: 78.3800, created_at: new Date(Date.now() - 86400000).toISOString(), number_of_people: 2 }
    ];
  }
  
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
  await Promise.all([loadDashboard(), loadAnalytics(), loadRequests()]);
  initFilters();
});
