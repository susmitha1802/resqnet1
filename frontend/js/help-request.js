/**
 * ResQNet — Help Request Form Logic
 */

let uploadedImage = null;
let userLocation = null;
let aiPreviewShown = false;

/* ── AI Priority Preview ── */
function computeAIPriority(requestType, people) {
  if (requestType === 'Rescue' || requestType === 'Medicine') return { level: 'High', color: '#EF4444', reason: 'Life-threatening emergency' };
  if (parseInt(people) > 10) return { level: 'High', color: '#EF4444', reason: 'Large number of affected people' };
  if (requestType === 'Food' || requestType === 'Water') return { level: 'Medium', color: '#F59E0B', reason: 'Essential supplies needed' };
  return { level: 'Low', color: '#10B981', reason: 'General assistance required' };
}

function updateAIPreview() {
  const type   = document.getElementById('request-type')?.value;
  const people = document.getElementById('people-count')?.value;

  if (!type || !people) return;

  const { level, color, reason } = computeAIPriority(type, people);
  const panel = document.getElementById('ai-preview-panel');
  if (!panel) return;

  panel.style.display = 'block';
  if (!aiPreviewShown) {
    panel.style.animation = 'slideInUp 0.4s ease';
    aiPreviewShown = true;
  }

  document.getElementById('ai-priority-level').textContent = level;
  document.getElementById('ai-priority-level').style.color = color;
  document.getElementById('ai-priority-reason').textContent = reason;

  // Forecast
  const foodPkts  = Math.ceil(parseInt(people) * 1.5);
  const waterLits = parseInt(people) * 3;
  const medKits   = Math.ceil(parseInt(people) / 5);
  document.getElementById('ai-food-forecast').textContent    = `${foodPkts} meal packets/day`;
  document.getElementById('ai-water-forecast').textContent   = `${waterLits}L drinking water/day`;
  document.getElementById('ai-medical-forecast').textContent = `${medKits} first-aid kits`;
}

/* ── Get Location ── */
function getLocation() {
  const btn = document.getElementById('get-location-btn');
  if (!navigator.geolocation) { Toast.show('Geolocation not supported', 'warning'); return; }

  btn.disabled = true;
  btn.innerHTML = '⏳ Getting...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById('lat-input').value = userLocation.lat.toFixed(6);
      document.getElementById('lng-input').value = userLocation.lng.toFixed(6);
      document.getElementById('location-display').textContent = `📍 ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
      btn.innerHTML = '✅ Captured';
      btn.style.background = 'var(--grad-success)';
      Toast.show('Location captured!', 'success');
    },
    () => {
      userLocation = { lat: 17.3850, lng: 78.4867 };
      document.getElementById('lat-input').value = userLocation.lat;
      document.getElementById('lng-input').value = userLocation.lng;
      document.getElementById('location-display').textContent = '📍 Hyderabad, Telangana (demo)';
      btn.innerHTML = '⚠️ Demo';
      Toast.show('Using demo location', 'warning');
    }
  );
}

/* ── Image Upload ── */
function initImageUpload() {
  const drop = document.getElementById('img-drop-area');
  const input = document.getElementById('img-input');
  const preview = document.getElementById('img-preview');

  drop?.addEventListener('click', () => input?.click());
  drop?.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop?.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleImage(f);
  });
  input?.addEventListener('change', () => { if (input.files[0]) handleImage(input.files[0]); });

  function handleImage(file) {
    if (!file.type.startsWith('image/')) { Toast.show('Please upload an image file', 'warning'); return; }
    uploadedImage = file;
    const url = URL.createObjectURL(file);
    if (preview) {
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="position:relative;display:inline-block">
          <img src="${url}" style="max-width:200px;max-height:150px;border-radius:10px;border:1px solid var(--border-glass)">
          <button onclick="removeImage()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:var(--danger);border:none;color:white;cursor:pointer">✕</button>
        </div>
        <p style="color:var(--success);font-size:0.8rem;margin-top:8px">🤖 AI damage severity analysis will run on submission</p>
      `;
    }
    if (drop) drop.style.display = 'none';
  }
}

window.removeImage = function() {
  uploadedImage = null;
  const preview = document.getElementById('img-preview');
  const drop = document.getElementById('img-drop-area');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  if (drop) drop.style.display = 'block';
};

/* ── Submit Handler ── */
async function handleHelpRequest(e) {
  e.preventDefault();

  const name    = document.getElementById('req-name').value.trim();
  const contact = document.getElementById('req-contact').value.trim();
  const type    = document.getElementById('request-type').value;
  const people  = document.getElementById('people-count').value;
  const desc    = document.getElementById('req-description').value.trim();

  if (!name || !contact || !type || !people) { Toast.show('Please fill in all required fields', 'warning'); return; }
  if (!userLocation) { Toast.show('Please capture your location', 'warning'); return; }

  const { level } = computeAIPriority(type, people);
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Processing...';

  const formData = new FormData();
  formData.append('name', name);
  formData.append('contact', contact);
  formData.append('request_type', type);
  formData.append('number_of_people', people);
  formData.append('description', desc);
  formData.append('latitude', userLocation.lat);
  formData.append('longitude', userLocation.lng);
  formData.append('priority_level', level);
  if (uploadedImage) formData.append('image', uploadedImage);

  await Api.postForm('/help-request', formData);

  document.getElementById('help-form').style.display = 'none';
  document.getElementById('success-state').style.display = 'flex';
  document.getElementById('success-priority').textContent = level;
  document.getElementById('success-priority').className = `badge-${level.toLowerCase()}`;

  Toast.show(`Help request submitted! Priority: ${level} 🚨`, level === 'High' ? 'danger' : 'success');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (!Session.isLoggedIn()) { location.href = 'auth.html'; return; }

  document.getElementById('request-type')?.addEventListener('change', updateAIPreview);
  document.getElementById('people-count')?.addEventListener('input', updateAIPreview);
  document.getElementById('get-location-btn')?.addEventListener('click', getLocation);
  document.getElementById('help-form')?.addEventListener('submit', handleHelpRequest);
  initImageUpload();
});
