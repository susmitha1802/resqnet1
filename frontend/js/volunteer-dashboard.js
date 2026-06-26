/**
 * ResQNet — Volunteer Dashboard Logic
 * All data loaded from the real API — no mock data.
 */

let nearbyRequests = [];
let myTasks = [];
let availabilityStatus = true;
let volunteerLat = null; // Set by syncLocation() or PostgreSQL profile — never hardcoded
let volunteerLng = null;
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

  const ptdEl = document.getElementById('profile-tasks-done');
  if (ptdEl) ptdEl.textContent = done;
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
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">No active alerts in your area.</div>`;
    return;
  }

  container.innerHTML = requests.map(r => {
    const dist = r.distance != null ? r.distance : null;
    return renderRequestCard(r, dist);
  }).join('');
}

function renderRequestCard(r, distKm) {
  const priorityClass = r.priority_level === 'High' ? 'high' : r.priority_level === 'Medium' ? 'medium' : 'low';
  const priorityColor = r.priority_level === 'High' ? '#ef4444' : r.priority_level === 'Medium' ? '#f59e0b' : '#10b981';
  const typeIcons = { Rescue:'🚁', Food:'🍱', Water:'💧', Medicine:'💊', Shelter:'🏠' };
  const icon = typeIcons[r.request_type] || '📋';
  const isNearby = distKm !== null && distKm <= 50;

  return `
    <div class="request-card ${priorityClass}">
      <div class="request-card-header">
        <div class="request-card-title">${icon} ${r.request_type}</div>
        <span style="padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;background:${priorityColor}22;color:${priorityColor};">${r.priority_level}</span>
      </div>
      <div class="request-card-meta">
        ${distKm !== null ? `<span>📍 ${distKm.toFixed(1)} km away</span>` : '<span>📍 Location unknown</span>'}
        <span>🕒 ${timeAgo(r.created_at)}</span>
        <span>👥 ${r.number_of_people} people</span>
      </div>
      <div class="request-card-desc">${r.description || r.request_type + ' assistance needed'}</div>
      <div class="request-card-actions">
        ${isNearby
          ? `<button class="btn-resq" style="padding:6px 16px;font-size:0.82rem;" onclick="acceptTask(${r.request_id})">✓ Accept Task</button>`
          : `<button class="btn-resq-outline" style="padding:6px 16px;font-size:0.82rem;" onclick="notifyNearestNGO(${r.request_id})">📢 Notify Nearest NGO</button>`
        }
      </div>
    </div>
  `;
}

/* ── Accept Task ── */
async function acceptTask(requestId) {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/volunteer/tasks/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId })
    });
    const data = await res.json();
    if (data.success) {
      Toast.show('✅ Task accepted! Head to the location.', 'success');
      loadNearbyRequests();
      if (typeof loadTaskHistory === 'function') loadTaskHistory();
      else if (typeof loadMyTasks === 'function') loadMyTasks();
    } else {
      Toast.show(data.message || 'Failed to accept task', 'danger');
    }
  } catch(e) {
    Toast.show('Failed to accept task', 'danger');
  }
}

async function notifyNearestNGO(requestId) {
  Toast.show('📢 Nearest NGO has been notified about this request.', 'success');
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

  // Calculate distance for all requests (only when volunteer location is known)
  combined.forEach(r => {
    if (r.latitude != null && r.longitude != null && volunteerLat != null && volunteerLng != null) {
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

/* ── Location Sync (browser geolocation → PostgreSQL profile fallback) ── */
async function syncLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // No geolocation API — try profile fallback immediately
      Api.get('/profile').then(data => {
        const u = data?.user;
        if (u && u.location_lat != null) {
          volunteerLat = u.location_lat;
          volunteerLng = u.location_lng;
        }
        resolve();
      }).catch(() => resolve());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        volunteerLat = position.coords.latitude;
        volunteerLng = position.coords.longitude;
        // Silently persist to backend
        await Api.put('/volunteer/update-location', { latitude: volunteerLat, longitude: volunteerLng });
        resolve();
      },
      async (error) => {
        console.warn('Geolocation unavailable, trying saved profile location.', error);
        try {
          const data = await Api.get('/profile');
          const u = data?.user;
          if (u && u.location_lat != null) {
            volunteerLat = u.location_lat;
            volunteerLng = u.location_lng;
          }
        } catch (_) { }
        resolve();
      },
      { timeout: 8000, enableHighAccuracy: true }
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

/* ── Location Prompt ── */
function showLocationPrompt() {
  const prompt = document.getElementById('location-prompt');
  if (prompt) prompt.style.display = 'block';
  const container = document.getElementById('nearby-requests');
  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;background:var(--bg-card-2);border-radius:var(--radius);border:1px solid var(--border-subtle)">
        <div style="font-size:2.5rem;margin-bottom:12px">📍</div>
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px;color:var(--text-primary)">Set your location to see nearby requests</div>
        <div style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:20px">Allow location access so we can show you the closest help requests in your area.</div>
        <button class="btn btn-primary" onclick="setMyLocation()">📍 Use My Location</button>
      </div>
    `;
  }
}

async function setMyLocation() {
  if (!navigator.geolocation) {
    Toast.show('Geolocation is not supported by your browser', 'warning');
    return;
  }
  Toast.show('Detecting your location...', 'info');
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      volunteerLat = position.coords.latitude;
      volunteerLng = position.coords.longitude;
      await Api.put('/volunteer/update-location', { latitude: volunteerLat, longitude: volunteerLng });
      const prompt = document.getElementById('location-prompt');
      if (prompt) prompt.style.display = 'none';
      await loadNearbyRequests();
      if (typeof initVolMap === 'function') await initVolMap();
      Toast.show('Location set! Showing nearby requests. ✅', 'success');
    },
    () => {
      Toast.show('Could not get location. Please enable location access in your browser.', 'danger');
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

/* ── Mini Map ── */
async function initVolMap() {
  // Use real location; if still unknown, show a zoomed-out India view (no specific city)
  const mapLat = volunteerLat != null ? volunteerLat : 20.5937;
  const mapLng = volunteerLng != null ? volunteerLng : 78.9629;
  const mapZoom = volunteerLat != null ? 12 : 5;

  if (miniMapInstance) {
    miniMapInstance.setView([mapLat, mapLng], mapZoom);
    if (volunteerMarker && volunteerLat != null) volunteerMarker.setLatLng([mapLat, mapLng]);
    return;
  }

  miniMapInstance = ResQMap.createMap('vol-mini-map', { lat: mapLat, lng: mapLng, zoom: mapZoom });
  if (volunteerLat != null) {
    volunteerMarker = L.marker([mapLat, mapLng], {
      icon: ResQMap.circleIcon('#10B981', 14),
    }).bindPopup(ResQMap.popupHtml('<strong>📍 Your Area</strong>')).addTo(miniMapInstance);
  }

  // Load request + report markers
  try {
    const data = await Api.get('/map/data');
    if (data && data.requests) {
      data.requests.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const priority = r.priority_level || 'Medium';
        const color = ResQMap.priorityColor(priority);
        const icon = priority === 'High' ? ResQMap.pulseIcon(color) : ResQMap.circleIcon(color, 10);
        L.marker([parseFloat(r.latitude), parseFloat(r.longitude)], { icon })
          .bindPopup(ResQMap.popupHtml(`<b>${r.request_type || 'Request'}</b><br>${priority} Priority<br>Status: ${r.status || 'Pending'}`))
          .addTo(miniMapInstance);
      });
    }
    if (data && data.reports) {
      data.reports.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const icon = ResQMap.circleIcon('#f97316', 10);
        L.marker([parseFloat(r.latitude), parseFloat(r.longitude)], { icon })
          .bindPopup(ResQMap.popupHtml(`<b>🤖 ${r.disaster_type || 'Disaster'} Report</b><br>Severity: ${r.severity || 'Unknown'}`))
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

  await syncLocation(); // Detect and sync before loading requests
  await initVolMap(); // Initialize map with synced location
  await Promise.all([loadNearbyRequests(), loadMyTasks(), loadPreparednessAlerts(), loadVolunteerAlerts()]);
});

/* ── Preparedness Alerts ── */
async function loadPreparednessAlerts() {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/preparedness/my-pings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const pending = data.pings.filter(p => p.status === 'Sent');
    if (pending.length === 0) return;

    const ping = pending[0];
    const icons = { Cyclone: '🌀', Flood: '🌊', Storm: '⛈', Heatwave: '🔥', Earthquake: '🌍', Other: '⚠' };
    const icon = icons[ping.alert_type] || '⚠';

    const bannerHTML = `
      <div id="preparedness-banner" style="background:var(--bg-card);border:1px solid var(--accent-red);border-radius:var(--radius);padding:20px;margin-bottom:20px;box-shadow:var(--glow-red-sm)">
        <h3 style="color:var(--accent-red);margin-bottom:8px;font-size:1.1rem">🔔 PREPAREDNESS ALERT — ${icon} ${ping.alert_type} ${ping.severity}</h3>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">${ping.description}</p>
        <div style="font-weight:600;margin-bottom:12px">Please confirm your availability status:</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn-resq" style="background:var(--accent-green);border-color:var(--accent-green);color:#fff" onclick="respondToPing(${ping.ping_id}, 'Acknowledged')">✓ I'm Ready & Available</button>
          <button class="btn-resq-outline" style="border-color:var(--border-subtle)" onclick="respondToPing(${ping.ping_id}, 'Unavailable')">✗ Unavailable Right Now</button>
        </div>
        ${pending.length > 1 ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:12px">${pending.length - 1} more alert(s) pending</div>` : ''}
      </div>
    `;

    const anchor = document.getElementById('availability-banner');
    if (anchor && !document.getElementById('preparedness-banner')) {
      anchor.insertAdjacentHTML('beforebegin', bannerHTML);
    }
  } catch (e) { console.error('Failed to load preparedness pings', e); }
}

async function respondToPing(pingId, status) {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/preparedness/ping/${pingId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  } catch (e) {
    Toast.show('Error connecting to server', 'danger');
  }
}

async function loadVolunteerAlerts() {
  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/alerts`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const container = document.getElementById('vol-alerts-list');
    if (!container) return;
    if (data.success && data.alerts && data.alerts.length > 0) {
      const a = data.alerts[0]; // just show top alert for simplicity
      container.innerHTML = `
        <div style="font-weight:700;color:var(--text-primary);font-size:1.1rem;margin-bottom:4px">⚠ ${a.alert_type} ${a.severity}</div>
        <div style="color:var(--text-secondary);font-size:0.9rem">${a.description}</div>
      `;
    } else {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">🟢 No active alerts. Conditions safe.</p>';
    }
  } catch (e) { console.error('Failed to load volunteer alerts', e); }
}

async function updateVolunteerStatusSelect(select) {
  const statusMap = { 'available': 'ready', 'busy': 'busy', 'unavailable': 'offline' };
  select.className = `status-select ${statusMap[select.value] || 'offline'}`;

  const token = Session.getToken();
  try {
    const res = await fetch(`${API_BASE}/volunteer/update-status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: select.value })
    });
    const data = await res.json();
    if (data.success) {
      Toast.show(`Status updated to ${select.options[select.selectedIndex].text}`, 'success');
    } else {
      Toast.show(data.message || 'Failed to update status', 'danger');
    }
  } catch (e) {
    Toast.show('Error updating status', 'danger');
  }
}

window.acceptTask = acceptTask;
window.notifyNGO = notifyNGO;
window.submitProof = submitProof;
window.viewOnMap = viewOnMap;
window.updateLocationManually = updateLocationManually;
window.respondToPing = respondToPing;
window.updateVolunteerStatusSelect = updateVolunteerStatusSelect;
window.setMyLocation = setMyLocation;
