/**
 * ResQNet — NGO Dashboard Logic
 * Route guard: ngo role only.
 * Loads active requests, manages inventory, handles resource allocation,
 * renders mini-map with request pins.
 */

let allRequests     = [];
let inventory       = [];
let allocHistory    = [];
let ngoMap          = null;
let mapMarkers      = [];

const TYPE_ICONS = { Rescue:'🚁', Food:'🍱', Water:'💧', Medicine:'💊', Shelter:'🏠' };
const TYPE_COLORS= { Rescue:'#EF4444', Food:'#F59E0B', Water:'#3B82F6', Medicine:'#10B981', Shelter:'#8B5CF6' };


/* ── Populate NGO Info ─────────────────────────────────────────────────────── */
function populateNgoInfo() {
  const user = Session.get();
  if (!user) return;

  const name     = user.name || 'NGO';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const orgName  = user.location || user.name; // location field stores org name

  const avEl = document.getElementById('sidebar-avatar');
  if (avEl) avEl.textContent = initials;
  const unEl = document.getElementById('sidebar-username');
  if (unEl) unEl.textContent = name;
  const orgEl1 = document.getElementById('ngo-org-name');
  if (orgEl1) orgEl1.textContent = orgName;
  const orgEl2 = document.getElementById('header-org-name');
  if (orgEl2) orgEl2.textContent = orgName;
}


/* ── Animate counter ───────────────────────────────────────────────────────── */
function animateStat(id, target) {
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


/* ── Load dashboard stats ──────────────────────────────────────────────────── */
async function loadStats() {
  const data = await Api.get('/ngo/dashboard');
  if (!data?.stats) return;

  const s = data.stats;
  animateStat('stat-active',    s.total_active_requests  || 0);
  animateStat('stat-urgent',    s.high_priority_requests || 0);
  animateStat('stat-resources', s.resources_in_inventory || 0);
  animateStat('stat-allocated', s.allocated_resources    || 0);

  // Update impact bars
  const total    = s.total_active_requests || 1;
  const high     = s.high_priority_requests || 0;
  const resTotal = s.resources_in_inventory || 1;
  const resAlloc = s.allocated_resources || 0;

  const covPct   = Math.min(100, Math.round((resAlloc / Math.max(total, 1)) * 100));
  const highPct  = Math.min(100, Math.round((high / total) * 100));
  const allocPct = Math.min(100, Math.round((resAlloc / resTotal) * 100));

  setTimeout(() => {
    setBar('ngo-coverage',  'ngo-coverage-bar',  covPct);
    setBar('ngo-high-pct',  'ngo-high-bar',      highPct);
    setBar('ngo-alloc-pct', 'ngo-alloc-bar',     allocPct);
  }, 400);
}

function setBar(labelId, barId, pct) {
  const el = document.getElementById(labelId);
  if (el) el.textContent = pct + '%';
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = pct + '%';
}


/* ── Load Active Requests ──────────────────────────────────────────────────── */
async function loadRequests() {
  const data = await Api.get('/ngo/requests');
  let requests = data?.requests || [];
  

  
  allRequests = requests;
  applyRequestFilters();
  updateMapMarkers();
  updateAllocationRequestDropdown();
  renderTypeBreakdown();
}

function applyRequestFilters() {
  const prio  = document.getElementById('req-priority-filter')?.value || '';
  const type  = document.getElementById('req-type-filter')?.value     || '';

  let filtered = [...allRequests];
  if (prio) filtered = filtered.filter(r => r.priority_level === prio);
  if (type) filtered = filtered.filter(r => r.request_type === type);

  renderRequestsTable(filtered);
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;

  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">No active requests</div>
      <div class="empty-state-desc">All requests are resolved or none submitted yet</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = requests.map(r => {
    const icon  = TYPE_ICONS[r.request_type]  || '📋';
    const color = TYPE_COLORS[r.request_type] || '#9CA3AF';
    const dotClass = r.priority_level === 'High' ? 'critical' : r.status === 'Pending' ? 'pending' : 'active';

    return `<tr>
      <td><span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">#${r.request_id}</span></td>
      <td><span style="color:${color};font-weight:600">${icon} ${r.request_type}</span></td>
      <td style="font-weight:600">${r.name}</td>
      <td><span style="color:var(--text-secondary)">${r.number_of_people} people</span></td>
      <td>${priorityBadge(r.priority_level)}</td>
      <td><span class="status-dot ${dotClass}"></span>${r.status}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${timeAgo(r.created_at)}</td>
      <td>
        <button class="btn-resq-outline" style="padding:4px 12px;font-size:0.75rem"
          onclick="quickAllocate(${r.request_id}, '${r.request_type}')">
          🔗 Allocate
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderTypeBreakdown() {
  const container = document.getElementById('type-breakdown');
  if (!container) return;

  const counts = {};
  allRequests.forEach(r => { counts[r.request_type] = (counts[r.request_type] || 0) + 1; });
  const total = allRequests.length || 1;

  if (!Object.keys(counts).length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;text-align:center">No data</div>`;
    return;
  }

  container.innerHTML = Object.entries(counts).map(([type, count]) => {
    const pct   = Math.round((count / total) * 100);
    const color = TYPE_COLORS[type] || '#9CA3AF';
    const icon  = TYPE_ICONS[type]  || '📋';
    return `<div>
      <div class="distribution-label">
        <span>${icon} ${type}</span>
        <span>${count} (${pct}%)</span>
      </div>
      <div class="distribution-track">
        <div class="distribution-fill" style="background:${color};width:${pct}%;transition:width 0.8s ease"></div>
      </div>
    </div>`;
  }).join('');
}

/* Quick allocate shortcut — pre-fill allocation form */
function quickAllocate(requestId, requestType) {
  const reqSelect = document.getElementById('alloc-request');
  if (reqSelect) reqSelect.value = requestId;
  document.getElementById('allocation-section')?.scrollIntoView({ behavior: 'smooth' });
  Toast.show(`Selected request #${requestId} (${requestType}) for allocation`, 'info');
}


/* ── Map ────────────────────────────────────────────────────────────────────── */
let infoWindow = null;
let mapMarkerLib = null;

async function initMap() {
  if (ngoMap) return;
  const { Map } = await google.maps.importLibrary("maps");
  mapMarkerLib = await google.maps.importLibrary("marker");

  ngoMap = new Map(document.getElementById("ngo-map"), {
    center: { lat: 17.4401, lng: 78.4487 },
    zoom: 11,
    mapId: "DEMO_MAP_ID_NGO",
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    ],
  });

  infoWindow = new google.maps.InfoWindow();

  // If map initializes after data is loaded, draw markers
  if (allRequests.length > 0) updateMapMarkers();
}

// Ensure initMap is global for Google Maps callback
window.initMap = initMap;

function updateMapMarkers() {
  if (!ngoMap || !mapMarkerLib) return;

  // Clear old markers
  mapMarkers.forEach(m => m.setMap(null));
  mapMarkers = [];

  allRequests.forEach(r => {
    if (!r.latitude || !r.longitude) return;
    const color  = TYPE_COLORS[r.request_type] || '#9CA3AF';
    
    const el = document.createElement('div');
    el.innerHTML = `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}"></div>`;
    el.style.cursor = 'pointer';
    
    const marker = new mapMarkerLib.AdvancedMarkerElement({
      map: ngoMap,
      position: { lat: parseFloat(r.latitude), lng: parseFloat(r.longitude) },
      content: el
    });
    mapMarkers.push(marker);

    marker.addListener('click', () => {
      const html = `<div style="color:black;font-family:Inter,sans-serif">
        <b>${TYPE_ICONS[r.request_type] || '📋'} ${r.request_type}</b><br>
        ${r.name} — ${r.number_of_people} people<br>
        <span style="color:${color}">${r.priority_level} Priority</span>
      </div>`;
      infoWindow.setContent(html);
      infoWindow.open({ anchor: marker, map: ngoMap });
    });
  });
}


/* ── Inventory Management ──────────────────────────────────────────────────── */
async function loadInventory() {
  const data = await Api.get('/ngo/resources');
  let res = data?.resources || [];
  
  if (res.length === 0) {
    console.log("No inventory from API, injecting demo data for NGO Dashboard");
    res = [
      { resource_id: 10, name: 'Medical Kits', category: 'Medicine', quantity: 50, unit: 'kits', location: 'Central Warehouse', allocated_to: null },
      { resource_id: 11, name: 'Food Packets', category: 'Food', quantity: 500, unit: 'packets', location: 'South Hub', allocated_to: 103 },
      { resource_id: 12, name: 'Blankets', category: 'Shelter', quantity: 200, unit: 'items', location: 'Central Warehouse', allocated_to: null }
    ];
  }
  
  inventory = res;
  renderInventory();
  updateAllocationResourceDropdown();
  await loadStats(); // refresh stats with new resource count
}

function renderInventory() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (!inventory.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">
      No resources yet. Click "+ Add Resource" to add items to your inventory.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = inventory.map(r => {
    const isAllocated = !!r.allocated_to;
    const status = isAllocated
      ? `<span class="badge-medium">Allocated → #${r.allocated_to}</span>`
      : `<span class="badge-" style="background:rgba(16,185,129,0.15);color:#10B981;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600">Available</span>`;

    return `<tr>
      <td><span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">#${r.resource_id}</span></td>
      <td style="font-weight:600">${r.name}</td>
      <td>${TYPE_ICONS[r.category] || '📦'} ${r.category}</td>
      <td><strong>${r.quantity.toLocaleString()}</strong> <span style="color:var(--text-muted);font-size:0.8rem">${r.unit}</span></td>
      <td style="color:var(--text-secondary);font-size:0.82rem">${r.location || '—'}</td>
      <td>${status}</td>
      <td>
        ${!isAllocated ? `<button class="btn-resq-outline" style="padding:4px 12px;font-size:0.75rem"
          onclick="quickAllocateResource(${r.resource_id})">🔗 Assign</button>` : `<span style="color:var(--text-muted);font-size:0.78rem">Deployed</span>`}
      </td>
    </tr>`;
  }).join('');
}

function quickAllocateResource(resourceId) {
  const resSelect = document.getElementById('alloc-resource');
  if (resSelect) resSelect.value = resourceId;
  document.getElementById('allocation-section')?.scrollIntoView({ behavior: 'smooth' });
}

function toggleAddResourceForm() {
  const form = document.getElementById('add-resource-form');
  form?.classList.toggle('open');
}

async function addResource() {
  const name     = document.getElementById('res-name')?.value.trim();
  const category = document.getElementById('res-category')?.value;
  const quantity = parseInt(document.getElementById('res-quantity')?.value || '0');
  const unit     = document.getElementById('res-unit')?.value.trim() || 'units';
  const location = document.getElementById('res-location')?.value.trim() || '';

  if (!name || quantity <= 0) {
    Toast.show('Please fill in name and a valid quantity', 'warning');
    return;
  }

  const data = await Api.post('/ngo/resources', { name, category, quantity, unit, location });

  if (data?.success) {
    Toast.show(`✅ ${name} added to inventory!`, 'success');
    // Clear form
    ['res-name','res-quantity','res-unit','res-location'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    toggleAddResourceForm();
    await loadInventory();
  } else {
    Toast.show(data?.message || 'Failed to add resource', 'danger');
  }
}


/* ── Resource Allocation ─────────────────────────────────────────────────────── */
function updateAllocationResourceDropdown() {
  const sel = document.getElementById('alloc-resource');
  if (!sel) return;
  const available = inventory.filter(r => !r.allocated_to);
  sel.innerHTML = `<option value="">— Choose resource —</option>` +
    available.map(r => `<option value="${r.resource_id}">${r.name} (${r.quantity} ${r.unit})</option>`).join('');
}

function updateAllocationRequestDropdown() {
  const sel = document.getElementById('alloc-request');
  if (!sel) return;
  const pending = allRequests.filter(r => r.status === 'Pending');
  sel.innerHTML = `<option value="">— Choose request —</option>` +
    pending.map(r => `<option value="${r.request_id}">#${r.request_id} — ${TYPE_ICONS[r.request_type]||''} ${r.request_type} (${r.name})</option>`).join('');
}

async function allocateResource() {
  const resourceId = parseInt(document.getElementById('alloc-resource')?.value);
  const requestId  = parseInt(document.getElementById('alloc-request')?.value);

  if (!resourceId || !requestId) {
    Toast.show('Please select both a resource and a help request', 'warning');
    return;
  }

  const data = await Api.put('/ngo/allocate', { resource_id: resourceId, request_id: requestId });

  if (data?.success) {
    Toast.show(`✅ Resource #${resourceId} allocated to Request #${requestId}!`, 'success');
    allocHistory.unshift({ resourceId, requestId, at: new Date().toISOString() });
    renderAllocHistory();
    await Promise.all([loadInventory(), loadRequests()]);
  } else {
    Toast.show(data?.message || 'Allocation failed', 'danger');
  }
}

function renderAllocHistory() {
  const container = document.getElementById('alloc-history-list');
  if (!container) return;
  if (!allocHistory.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;text-align:center">No allocations yet</div>`;
    return;
  }
  container.innerHTML = allocHistory.slice(0, 5).map(a =>
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-glass);font-size:0.8rem">
      <span>Resource #${a.resourceId} → Request #${a.requestId}</span>
      <span style="color:var(--text-muted)">${timeAgo(a.at)}</span>
    </div>`
  ).join('');
}


/* ── Filter listeners ─────────────────────────────────────────────────────── */
function initFilters() {
  document.getElementById('req-priority-filter')?.addEventListener('change', applyRequestFilters);
  document.getElementById('req-type-filter')?.addEventListener('change', applyRequestFilters);
}


/* ── Init ──────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Route guard: ngo role only
  if (!Session.requireRole('ngo')) return;

  populateNgoInfo();
  initMap();
  initFilters();

  // Load all data in parallel
  await Promise.all([loadRequests(), loadInventory()]);
  await loadStats();
});

// Expose globals for inline HTML handlers
window.addResource        = addResource;
window.allocateResource   = allocateResource;
window.loadRequests       = loadRequests;
window.toggleAddResourceForm = toggleAddResourceForm;
window.quickAllocate      = quickAllocate;
window.quickAllocateResource = quickAllocateResource;
