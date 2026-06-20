/**
 * ResQNet — Shared Leaflet Map Utilities
 * Zero API key required. Uses:
 *   - Leaflet.js 1.9.4 (mapping)
 *   - OpenStreetMap tiles (free, no key)
 *   - Leaflet.markercluster (clustering)
 *   - Nominatim (geocoding, free, no key)
 */

/* ── OSM Dark Tile Layer ──────────────────────────────────────────────────── */
const OSM_TILE_URL    = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_DARK_URL    = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const STADIA_ATTR     = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Create a Leaflet map with a dark OSM tile layer.
 * Falls back to standard OSM if Stadia dark tiles fail.
 */
window.ResQMap = {

  /**
   * Initialize a Leaflet map in the given container element ID.
   * @param {string} containerId - DOM element ID
   * @param {object} opts - { lat, lng, zoom }
   * @returns {L.Map}
   */
  createMap(containerId, { lat = 17.4401, lng = 78.4487, zoom = 12 } = {}) {
    const map = L.map(containerId, {
      center: [lat, lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Primary: Stadia dark tiles (no key needed for tile.openstreetmap usage)
    // Fallback: Standard OSM
    const darkLayer = L.tileLayer(OSM_DARK_URL, {
      attribution: STADIA_ATTR,
      maxZoom: 19,
    });

    const osmLayer = L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    });

    // Try dark; on tile error fall back to OSM
    darkLayer.on('tileerror', () => {
      if (!map._fallbackAdded) {
        map._fallbackAdded = true;
        osmLayer.addTo(map);
        darkLayer.remove();
      }
    });

    darkLayer.addTo(map);

    // Apply dark CSS filter to the map container for consistent theming
    const container = document.getElementById(containerId);
    if (container) container.style.filter = 'brightness(0.88) contrast(1.05)';

    return map;
  },

  /* ── Marker Factories ─────────────────────────────────────────────────── */

  /**
   * Create a simple coloured circle marker icon.
   */
  circleIcon(color, size = 24) {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 0 8px ${color},0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  },

  /**
   * Create a pulsing circle marker icon (for High-priority markers).
   */
  pulseIcon(color) {
    const size = 26;
    const innerSize = 14;
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;width:${size}px;height:${size}px;cursor:pointer">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:resq-ripple 1.5s ease-out infinite"></div>
        <div style="position:absolute;top:${(size-innerSize)/2}px;left:${(size-innerSize)/2}px;width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color}"></div>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  },

  /**
   * Colour for a help request based on priority.
   */
  priorityColor(priority) {
    return priority === 'High' ? '#EF4444' : priority === 'Medium' ? '#F59E0B' : '#10B981';
  },

  /* ── Marker Cluster Group ─────────────────────────────────────────────── */
  createClusterGroup() {
    if (typeof L.markerClusterGroup !== 'function') return null;
    return L.markerClusterGroup({
      maxClusterRadius: 60,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:rgba(255,75,43,0.85);border:3px solid rgba(255,255,255,0.7);
            display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:0.78rem;color:white;
            box-shadow:0 0 10px rgba(255,75,43,0.5);
          ">${count}</div>`,
          className: '',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
  },

  /* ── Popup Styling ────────────────────────────────────────────────────── */
  /**
   * Create a styled dark popup HTML string.
   */
  popupHtml(content) {
    return `<div style="
      font-family:'Inter',sans-serif;min-width:200px;
      color:#F0F4FF;font-size:0.85rem;line-height:1.55;
    ">${content}</div>`;
  },

  /* ── Nominatim Geocoding (no API key) ─────────────────────────────────── */

  /**
   * Forward geocoding — address string → { lat, lng, displayName }
   * Rate-limited to 1 req/sec by OSM policy.
   */
  async geocode(query) {
    if (!query || query.trim().length < 3) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      return data.map(r => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        displayName: r.display_name,
        shortName: r.display_name.split(',').slice(0, 3).join(', '),
      }));
    } catch {
      return [];
    }
  },

  /**
   * Reverse geocoding — { lat, lng } → readable address string
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data?.display_name) {
        // Return a concise 3-part address
        return data.display_name.split(',').slice(0, 3).join(', ');
      }
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },

  /* ── Click-to-Pick Location ────────────────────────────────────────────── */

  /**
   * Enable click-to-pick on a map.
   * Calls onPick(lat, lng, addressString) whenever user clicks.
   */
  enableLocationPicker(map, onPick) {
    let pickerMarker = null;

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;

      if (pickerMarker) {
        pickerMarker.setLatLng([lat, lng]);
      } else {
        pickerMarker = L.marker([lat, lng], {
          icon: ResQMap.pulseIcon('#FF4B2B'),
          zIndexOffset: 1000,
        }).addTo(map);
      }

      pickerMarker.bindPopup(`<div style="color:#111;font-size:0.82rem">📍 Selected Location<br>${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`).openPopup();

      // Reverse geocode in background
      const address = await ResQMap.reverseGeocode(lat, lng);
      onPick(lat, lng, address);
    });

    return {
      clear() {
        if (pickerMarker) { pickerMarker.remove(); pickerMarker = null; }
      }
    };
  },

  /* ── Address Search Bar ────────────────────────────────────────────────── */

  /**
   * Attach a search input (by element ID) to the map.
   * Debounced — fires 600ms after last keystroke.
   */
  attachSearchBar(map, inputId, resultsId, onSelect) {
    const input   = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = input.value.trim();
      if (q.length < 3) { results.style.display = 'none'; return; }

      debounce = setTimeout(async () => {
        const hits = await ResQMap.geocode(q);
        if (!hits || !hits.length) { results.style.display = 'none'; return; }

        results.innerHTML = hits.map((h, i) => `
          <div data-idx="${i}" style="
            padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);
            font-size:0.82rem;color:#e5e7eb;transition:background 0.15s;
          " onmouseover="this.style.background='rgba(255,75,43,0.12)'"
             onmouseout="this.style.background=''">${h.shortName}</div>
        `).join('');

        results.style.display = 'block';

        results.querySelectorAll('[data-idx]').forEach(el => {
          el.addEventListener('click', () => {
            const h = hits[parseInt(el.dataset.idx)];
            map.setView([h.lat, h.lng], 15);
            input.value = h.shortName;
            results.style.display = 'none';
            if (onSelect) onSelect(h.lat, h.lng, h.shortName);
          });
        });
      }, 600);
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
      }
    });
  },
};

/* ── Global CSS for pulse animation ────────────────────────────────────── */
(function injectCSS() {
  if (document.getElementById('resqmap-style')) return;
  const style = document.createElement('style');
  style.id = 'resqmap-style';
  style.textContent = `
    @keyframes resq-ripple {
      0%   { transform: scale(0);   opacity: 0.8; }
      100% { transform: scale(4);   opacity: 0;   }
    }
    .leaflet-popup-content-wrapper {
      background: #111827 !important;
      border: 1px solid rgba(255,75,43,0.3) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      color: #F0F4FF !important;
    }
    .leaflet-popup-tip { background: #111827 !important; }
    .leaflet-popup-close-button { color: #9CA3AF !important; font-size: 18px !important; top: 6px !important; right: 8px !important; }
    .leaflet-popup-content { margin: 14px 16px !important; }
    .leaflet-control-zoom a { background:#1f2937 !important; color:#e5e7eb !important; border-color: rgba(255,255,255,0.1) !important; }
    .leaflet-control-zoom a:hover { background:#374151 !important; }
    .leaflet-control-attribution { background: rgba(17,24,39,0.85) !important; color:#6b7280 !important; font-size:0.65rem !important; }
    .leaflet-control-attribution a { color:#9ca3af !important; }
  `;
  document.head.appendChild(style);
})();
