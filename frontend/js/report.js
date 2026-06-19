/**
 * ResQNet — Disaster Report Form Logic
 */

let selectedDisasterType = null;
let uploadedFiles = [];
let userLocation = null;

/* ── Disaster Type Selection ── */
function selectDisasterType(type) {
  selectedDisasterType = type;
  document.querySelectorAll('.disaster-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === type);
  });
  document.getElementById('disaster-type-input').value = type;

  // Show severity hint
  const hints = {
    Flood:      { icon: '🌊', desc: 'Report water levels, affected areas, and number of trapped people.' },
    Cyclone:    { icon: '🌀', desc: 'Mention wind intensity, structural damage, and evacuation needs.' },
    Earthquake: { icon: '🌍', desc: 'Describe magnitude impact, building collapses, and trapped victims.' },
    Landslide:  { icon: '⛰️', desc: 'Report blocked roads, buried structures, and safe zones.' },
    Fire:       { icon: '🔥', desc: 'Indicate fire spread area, evacuation status, and proximity to structures.' }
  };

  const hintBox = document.getElementById('disaster-hint');
  if (hintBox && hints[type]) {
    hintBox.innerHTML = `<div class="resq-alert info" style="margin:0">${hints[type].icon} <span><strong>${type}</strong> — ${hints[type].desc}</span></div>`;
    hintBox.style.display = 'block';
  }
}

/* ── Get Location ── */
function getLocation() {
  const btn = document.getElementById('get-location-btn');
  const locInput = document.getElementById('location-input');
  const locStatus = document.getElementById('location-status');

  if (!navigator.geolocation) {
    Toast.show('Geolocation not supported by your browser', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '⏳ Getting location...';
  if (locStatus) locStatus.textContent = 'Detecting your location...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById('lat-input').value = userLocation.lat.toFixed(6);
      document.getElementById('lng-input').value = userLocation.lng.toFixed(6);
      if (locInput) locInput.value = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
      if (locStatus) locStatus.textContent = `✅ Location captured: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
      btn.innerHTML = '✅ Location Captured';
      btn.style.background = 'var(--grad-success)';
      Toast.show('Location captured successfully!', 'success');
    },
    () => {
      // Fallback demo location
      userLocation = { lat: 17.3850, lng: 78.4867 };
      document.getElementById('lat-input').value = userLocation.lat;
      document.getElementById('lng-input').value = userLocation.lng;
      if (locInput) locInput.value = 'Hyderabad, Telangana (demo)';
      if (locStatus) locStatus.textContent = '⚠️ Using demo location (Hyderabad)';
      btn.innerHTML = '⚠️ Demo Location';
      Toast.show('Using demo location for preview', 'warning');
    }
  );
}

/* ── File Upload ── */
function initFileUpload() {
  const dropArea = document.getElementById('file-drop-area');
  const fileInput = document.getElementById('file-input');
  const preview = document.getElementById('file-preview');

  if (!dropArea || !fileInput) return;

  dropArea.addEventListener('click', () => fileInput.click());
  dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault(); dropArea.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });
  fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

  function handleFiles(files) {
    files.forEach(file => {
      if (uploadedFiles.length >= 5) { Toast.show('Maximum 5 files allowed', 'warning'); return; }
      if (file.size > 10 * 1024 * 1024) { Toast.show(`${file.name} exceeds 10MB limit`, 'danger'); return; }
      uploadedFiles.push(file);
      renderPreviews();
    });
  }

  function renderPreviews() {
    if (!preview) return;
    preview.innerHTML = uploadedFiles.map((f, i) => `
      <div style="position:relative;display:inline-block;margin:4px">
        <div style="width:80px;height:80px;border-radius:8px;background:var(--bg-card-2);border:1px solid var(--border-glass);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:0.65rem;color:var(--text-muted);text-align:center;padding:4px;overflow:hidden">
          ${f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">` : `📁<br>${f.name.slice(0,12)}`}
        </div>
        <button onclick="removeFile(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--danger);border:none;color:white;font-size:0.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
    `).join('');
  }
}

window.removeFile = function(i) {
  uploadedFiles.splice(i, 1);
  const preview = document.getElementById('file-preview');
  if (preview) {
    const items = preview.children;
    if (items[i]) items[i].remove();
  }
};

/* ── Submit Handler ── */
async function handleReportSubmit(e) {
  e.preventDefault();

  if (!selectedDisasterType) { Toast.show('Please select a disaster type', 'warning'); return; }
  const desc = document.getElementById('report-description').value.trim();
  if (!desc) { Toast.show('Please provide a description', 'warning'); return; }
  if (!userLocation) { Toast.show('Please capture your location', 'warning'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Submitting report...';

  const formData = new FormData();
  formData.append('disaster_type', selectedDisasterType);
  formData.append('description', desc);
  formData.append('latitude', userLocation.lat);
  formData.append('longitude', userLocation.lng);
  uploadedFiles.forEach(f => formData.append('images', f));

  const data = await Api.postForm('/report-disaster', formData);

  // Show success state
  document.getElementById('report-form').style.display = 'none';
  document.getElementById('success-state').style.display = 'flex';

  Toast.show('Disaster report submitted successfully! 🚨', 'success');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (!Session.isLoggedIn()) { location.href = 'auth.html'; return; }

  document.querySelectorAll('.disaster-chip').forEach(c => {
    c.addEventListener('click', () => selectDisasterType(c.dataset.type));
  });

  document.getElementById('get-location-btn')?.addEventListener('click', getLocation);
  document.getElementById('report-form')?.addEventListener('submit', handleReportSubmit);
  initFileUpload();
});
