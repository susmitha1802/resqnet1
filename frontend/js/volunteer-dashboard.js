/**
 * ResQNet — Volunteer Dashboard Logic
 * All data loaded from the real API — no mock data.
 */

let nearbyRequests = [];
let myTasks = [];
let availabilityStatus = true;
let volunteerLat = 17.3850; // Fallback to Hyderabad
let volunteerLng = 78.4867;
let miniMapInstance = null;
let volunteerMarker = null;

/* ── Haversine Distance ── */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ── Populate Volunteer Info ── */
function populateVolunteerInfo() {
  const user = Session.get();
  if (!user) return;
  const name = user.name || 'Volunteer';
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
  const total = nearbyRequests.length;
  const within5km = nearbyRequests.filter(r => r.distance != null && r.distance <= 5).length;
  const high = nearbyRequests.filter(r => r.priority_level === 'High').length;
  const accepted = myTasks.length;
  const done = myTasks.filter(t => t.status === 'Completed').length;

  animateStatCounter('stat-nearby', total);
  animateStatCounter('stat-high', high);
  animateStatCounter('stat-accepted', accepted);
  animateStatCounter('stat-completed', done);

  // Widget update
  const widget = document.getElementById('nearby-widget');
  const widgetCount = document.getElementById('nearby-5km-count');
  if (widget && widgetCount) {
    if (within5km > 0) {
      widgetCount.textContent = within5km;
      widget.style.display = 'block';
    } else {
      widget.style.display = 'none';
    }
  }
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
        <div class="meta-chip">📍 ${r.distance != null ? r.distance.toFixed(1) + ' km away' : r.latitude?.toFixed(4) + ', ' + r.longitude?.toFixed(4)}</div>
        ${r.is_report ? '' : `<div class="meta-chip">👥 ${r.number_of_people} affected</div>`}
        ${r.is_report ? '' : (r.contact && r.contact !== 'N/A' ? `<div class="meta-chip">📞 ${r.contact}</div>` : '')}
        <div class="meta-chip">🕐 ${timeAgo(r.created_at)}</div>
      </div>
      <p class="request-card-desc">${r.description || 'No description provided.'}</p>
      <div class="request-card-actions">
        ${r.is_report
      ? `<div class="btn-resq-secondary" style="padding:9px 20px;font-size:0.85rem;background:rgba(249,115,22,0.1);color:#F97316;border:1px solid rgba(249,115,22,0.3);text-align:center;cursor:default">🔥 Hazard Alert</div>`
      : r.status === 'Pending'
        ? `<button class="btn-resq-primary" style="padding:9px 20px;font-size:0.85rem" onclick="acceptTask(${r.request_id})">✅ Accept Task</button>`
        : `<button class="btn-resq-secondary" style="padding:9px 20px;font-size:0.85rem" disabled>🔄 ${r.status}</button>`
    }
        ${r.is_report ? '' : `<a href="tel:${r.contact}" class="btn-resq-outline" style="padding:9px 20px;font-size:0.85rem">📞 Call</a>`}
        <button class="btn-resq-secondary" style="padding:9px 20px;font-size:0.85rem" onclick="viewOnMap(${r.latitude},${r.longitude},'${r.is_report ? 'R' + r.report_id : r.request_id}')">🗺️ Navigate</button>
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

/* ── Submit Proof ── */
async function submitProof(event, taskId) {
  event.preventDefault();
  const fileInput = document.getElementById(`proof_img_${taskId}`);
  const notesInput = document.getElementById(`proof_notes_${taskId}`);

  const file = fileInput.files[0];
  if (!file) return Toast.show('Please select an image', 'warning');

  const formData = new FormData();
  formData.append('proof_image', file);
  formData.append('notes', notesInput.value);

  const btn = event.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const res = await fetch(`${API_BASE}/volunteer/upload-proof/${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('resqnet_token')
      },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      Toast.show('Proof uploaded! Pending review. ✅', 'success');
      await loadMyTasks();
      updateStats();
    } else {
      Toast.show(data.message || 'Upload failed', 'danger');
      btn.disabled = false;
      btn.textContent = '📤 Submit Proof';
    }
  } catch (err) {
    Toast.show('Network error', 'danger');
    btn.disabled = false;
    btn.textContent = '📤 Submit Proof';
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
        ${['Assigned', 'En Route', 'On Site'].includes(t.status)
      ? `<form onsubmit="submitProof(event, ${t.task_id})" style="display:flex; flex-direction:column; gap:5px; max-width:250px;">
               <input type="file" id="proof_img_${t.task_id}" accept="image/*" required class="resq-input" style="padding: 4px; font-size:0.75rem;">
               <textarea id="proof_notes_${t.task_id}" placeholder="Completion notes" class="resq-input" style="min-height:40px; font-size:0.75rem; padding:4px;" required></textarea>
               <button type="submit" class="btn-resq-primary" style="padding:4px 10px; font-size:0.75rem">📤 Upload Proof</button>
             </form>`
      : t.status === 'Proof Submitted'
        ? `<span class="badge-pending">⏳ Pending Admin</span>`
        : `<span style="color:var(--text-muted);font-size:0.82rem">${t.status}</span>`
    }
      </td>
    </tr>
  `).join('');
}

/* ── Load from real API ── */
async function loadNearbyRequests() {
  const reqData = await Api.get('/help-requests');
  const repData = await Api.get('/reports');

  let pending = reqData?.requests?.filter(r => r.status === 'Pending') || [];
  let reports = repData?.reports || [];

  // Transform reports into a similar structure as help requests for rendering
  let mergedReports = reports.map(r => ({
    request_id: 'R' + r.report_id, // Prefix with R to distinguish
    request_type: r.disaster_type || 'General Disaster',
    priority_level: 'High', // Treat general disasters as high priority hazards
    status: 'Info Only',
    latitude: r.latitude,
    longitude: r.longitude,
    number_of_people: 'Unknown',
    contact: 'N/A',
    created_at: r.created_at,
    description: `[Disaster Report] ${r.disaster_type}: ${r.description || ''}`,
    is_report: true, // Flag to hide accept button
    report_id: r.report_id
  }));

  let combined = [...pending, ...mergedReports];

  // Calculate distance for all requests
  combined.forEach(r => {
    if (r.latitude != null && r.longitude != null) {
      r.distance = haversine(volunteerLat, volunteerLng, r.latitude, r.longitude);
    } else {
      r.distance = 9999;
    }
  });

  nearbyRequests = combined;
  applyFilters();
  updateStats();
}

async function loadMyTasks() {
  const data = await Api.get('/volunteer/tasks');
  let tasks = data?.tasks || [];

  myTasks = tasks;
  renderMyTasks();
  updateStats();
}

/* ── Filter ── */
function applyFilters() {
  const prio = document.getElementById('priority-filter')?.value || '';
  const type = document.getElementById('type-filter')?.value || '';
  const query = document.getElementById('search-input')?.value?.toLowerCase() || '';

  let filtered = [...nearbyRequests];
  if (prio && prio !== 'Nearest') filtered = filtered.filter(r => r.priority_level === prio);
  if (type) filtered = filtered.filter(r => r.request_type === type);
  if (query) filtered = filtered.filter(r =>
    r.request_type?.toLowerCase().includes(query) ||
    r.description?.toLowerCase().includes(query) ||
    r.name?.toLowerCase().includes(query)
  );

  // Sorting Logic: High Priority First, then Nearest Distance
  filtered.sort((a, b) => {
    if (prio === 'Nearest') {
      return a.distance - b.distance;
    } else {
      const pA = a.priority_level === 'High' ? 3 : (a.priority_level === 'Medium' ? 2 : 1);
      const pB = b.priority_level === 'High' ? 3 : (b.priority_level === 'Medium' ? 2 : 1);
      if (pB !== pA) return pB - pA; // High priority first
      return a.distance - b.distance; // Then nearest distance
    }
  });

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
  const label = document.getElementById('availability-label');

  toggle?.addEventListener('change', async () => {
    availabilityStatus = toggle.checked;
    banner?.classList.toggle('unavailable', !availabilityStatus);
    if (label) label.textContent = availabilityStatus ? 'Available for Tasks' : 'Currently Unavailable';
    await Api.put('/volunteer/update-status', { status: availabilityStatus ? 'available' : 'unavailable' });
    Toast.show(availabilityStatus ? '✅ You are now available' : '⛔ Marked as unavailable', availabilityStatus ? 'success' : 'warning');
  });
}

/* ── View on Map ── */
function viewOnMap(lat, lng, reqId) {
  let param = '';
  if (reqId) {
    if (typeof reqId === 'string' && reqId.startsWith('R')) {
      param = `&report_id=${reqId.substring(1)}`;
    } else {
      param = `&request_id=${reqId}`;
    }
  }
  window.open(`map.html?lat=${lat}&lng=${lng}${param}`, '_blank');
}

/* ── Location Sync ── */
async function syncLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        volunteerLat = position.coords.latitude;
        volunteerLng = position.coords.longitude;
        await Api.put('/volunteer/update-location', { latitude: volunteerLat, longitude: volunteerLng });
        resolve();
      },
      (error) => {
        console.warn('Geolocation denied or failed. Using fallback location.', error);
        resolve(); // Fallback to default
      },
      { timeout: 5000 }
    );
  });
}

async function updateLocationManually() {
  const btn = document.getElementById('update-loc-btn');
  if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

  await syncLocation();
  await loadNearbyRequests(); // Recalculate distance
  if (typeof initVolMap === 'function') await initVolMap();

  Toast.show('Location updated successfully', 'success');
  if (btn) btn.innerHTML = '📍 Update My Location';
}

/* ── Mini Map ── */
async function initVolMap() {
  if (miniMapInstance) {
    miniMapInstance.setView([volunteerLat, volunteerLng], 12);
    if (volunteerMarker) volunteerMarker.setLatLng([volunteerLat, volunteerLng]);
    return;
  }

  miniMapInstance = ResQMap.createMap('vol-mini-map', { lat: volunteerLat, lng: volunteerLng, zoom: 12 });
  volunteerMarker = L.marker([volunteerLat, volunteerLng], {
    icon: ResQMap.circleIcon('#10B981', 14),
  }).bindPopup(ResQMap.popupHtml('<strong>📍 Your Area</strong>')).addTo(miniMapInstance);

  // Load request markers
  try {
    const data = await Api.get('/map/data');
    if (data && data.requests) {
      data.requests.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const priority = r.priority_level || 'Medium';
        const color = ResQMap.priorityColor(priority);
        const icon = priority === 'High' ? ResQMap.pulseIcon(color) : ResQMap.circleIcon(color, 10);
        L.marker([parseFloat(r.latitude), parseFloat(r.longitude)], { icon })
          .bindPopup(ResQMap.popupHtml(`<b>${r.request_type || r.disaster_type || 'Disaster'}</b><br>${priority} Priority`))
          .addTo(miniMapInstance);
      });
    }
  } catch (err) {
    console.warn('Mini-map data load failed:', err);
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  // Route guard: volunteer role only
  if (!Session.requireRole('volunteer')) return;
  populateVolunteerInfo();
  initFilters();
  initAvailabilityToggle();
  await syncLocation(); // Detect and sync before loading requests
  await initVolMap(); // Initialize map with synced location
  await Promise.all([loadNearbyRequests(), loadMyTasks(), loadPreparednessAlerts()]);
});

/* ── Preparedness Alerts ── */
async function loadPreparednessAlerts() {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/preparedness/my-pings`, {
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    const data = await res.json();
    if (!data.success) return;
    
    const pending = data.pings.filter(p => p.status === 'Sent');
    if (pending.length === 0) return;
    
    const ping = pending[0];
    const icons = { Cyclone: '🌀', Flood: '🌊', Storm: '⛈', Heatwave: '🔥', Earthquake: '🌍', Other: '⚠' };
    const icon = icons[ping.alert_type] || '⚠';
    
    const bannerHTML = \`
      <div id="preparedness-banner" style="background:var(--bg-card);border:1px solid var(--accent-red);border-radius:var(--radius);padding:20px;margin-bottom:20px;box-shadow:var(--glow-red-sm)">
        <h3 style="color:var(--accent-red);margin-bottom:8px;font-size:1.1rem">🔔 PREPAREDNESS ALERT — \${icon} \${ping.alert_type} \${ping.severity}</h3>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">\${ping.description}</p>
        <div style="font-weight:600;margin-bottom:12px">Please confirm your availability status:</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn-resq" style="background:var(--accent-green);border-color:var(--accent-green);color:#fff" onclick="respondToPing(\${ping.ping_id}, 'Acknowledged')">✓ I'm Ready & Available</button>
          <button class="btn-resq-outline" style="border-color:var(--border-subtle)" onclick="respondToPing(\${ping.ping_id}, 'Unavailable')">✗ Unavailable Right Now</button>
        </div>
        \${pending.length > 1 ? \`<div style="font-size:0.8rem;color:var(--text-muted);margin-top:12px">\${pending.length - 1} more alert(s) pending</div>\` : ''}
      </div>
    \`;
    
    const anchor = document.getElementById('availability-banner');
    if (anchor && !document.getElementById('preparedness-banner')) {
      anchor.insertAdjacentHTML('beforebegin', bannerHTML);
    }
  } catch(e) { console.error('Failed to load preparedness pings', e); }
}

async function respondToPing(pingId, status) {
  const token = getToken();
  try {
    const res = await fetch(\`\${API_BASE}/preparedness/ping/\${pingId}\`, {
      method: 'PUT',
      headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      Toast.show('Status updated successfully!', 'success');
      const banner = document.getElementById('preparedness-banner');
      if (banner) banner.remove();
      loadPreparednessAlerts();
    } else {
      Toast.show(data.message || 'Failed to update status', 'danger');
    }
  } catch(e) {
    Toast.show('Error connecting to server', 'danger');
  }
}

window.acceptTask = acceptTask;
window.submitProof = submitProof;
window.viewOnMap = viewOnMap;
window.updateLocationManually = updateLocationManually;
window.respondToPing = respondToPing;
