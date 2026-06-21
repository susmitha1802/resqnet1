"""
ResQNet -- Full Upload-to-Prediction Pipeline Test
===================================================
Tests the COMPLETE path a user image takes:
  1. Login via /auth/login  -> get JWT
  2. Generate a real test image (real PNG pixels, not stub)
  3. POST to /report-disaster with multipart form (image + fields)
  4. Verify response contains predicted_disaster_type + confidence
  5. Check the saved file is on disk
  6. Run predict_disaster() on the saved file directly (cross-check)

Run:  python test_image_upload.py
"""
import os
import sys
import json
import time
import traceback
import requests
import numpy as np

sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

BASE_URL   = 'http://127.0.0.1:5000'
BACKEND    = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
AI_DIR     = os.path.join(BACKEND, 'ai')
UPLOAD_DIR = os.path.join(BACKEND, 'uploads', 'reports')

sys.path.insert(0, BACKEND)
sys.path.insert(0, AI_DIR)

SEP  = '=' * 70
SEP2 = '-' * 50

def banner(t): print(f'\n{SEP}\n  {t}\n{SEP}')
def ok(m):    print(f'[PASS] {m}')
def fail(m):  print(f'[FAIL] {m}')
def warn(m):  print(f'[WARN] {m}')
def info(m):  print(f'       {m}')

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Generate a real JPEG test image (flood-like blue)
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 1 -- Generate Real Test Image (flood scene, 128x128 JPEG)')
TEST_IMG_PATH = os.path.join(BACKEND, 'uploads', 'test_scratch', 'upload_test_flood.jpg')
os.makedirs(os.path.dirname(TEST_IMG_PATH), exist_ok=True)

try:
    from PIL import Image
    # Create a richer 128x128 image with gradient + noise (more realistic than flat colour)
    arr = np.zeros((128, 128, 3), dtype=np.uint8)
    for y in range(128):
        for x in range(128):
            arr[y, x] = [
                int(20  + 30  * (x / 128)),   # R: dark-ish
                int(60  + 80  * (y / 128)),   # G: medium
                int(150 + 80  * (1 - x/128)), # B: dominant blue (flood)
            ]
    noise = np.random.randint(-20, 20, (128, 128, 3))
    arr   = np.clip(arr.astype(int) + noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(TEST_IMG_PATH, format='JPEG', quality=85)
    size_kb = os.path.getsize(TEST_IMG_PATH) / 1024
    ok(f'Image saved: {TEST_IMG_PATH}  ({size_kb:.1f} KB)')
except Exception as e:
    fail(f'Image generation failed: {e}')
    traceback.print_exc()
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Login and get JWT
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 2 -- Login via /auth/login')

# Try known test users in order of preference
CANDIDATES = [
    {'email': 'alice@example.com',  'password': 'password123'},
    {'email': 'test@example.com',   'password': 'password123'},
    {'email': 'victim@test.com',    'password': 'password123'},
    {'email': 'user@resqnet.com',   'password': 'password123'},
]

token = None
logged_in_email = None
for cred in CANDIDATES:
    try:
        r = requests.post(f'{BASE_URL}/auth/login', json=cred, timeout=10)
        if r.status_code == 200 and r.json().get('success'):
            token = r.json()['access_token']
            logged_in_email = cred['email']
            ok(f'Logged in as: {logged_in_email}')
            info(f'Token (first 40 chars): {token[:40]}...')
            break
        else:
            info(f'  {cred["email"]} -> HTTP {r.status_code}: {r.json().get("message","?")}')
    except Exception as e:
        info(f'  {cred["email"]} -> Connection error: {e}')

if not token:
    # Register a fresh victim account and log in
    warn('No existing test user found. Registering fresh account...')
    reg_payload = {
        'name': 'Upload Tester',
        'email': 'uploadtest@resqnet.com',
        'password': 'test1234',
        'phone': '9000000001',
        'role': 'victim',
    }
    try:
        r = requests.post(f'{BASE_URL}/auth/register', json=reg_payload, timeout=10)
        info(f'Register response: HTTP {r.status_code} -> {r.json().get("message","?")}')
        # Now login
        r2 = requests.post(f'{BASE_URL}/auth/login',
                           json={'email': reg_payload['email'], 'password': reg_payload['password']},
                           timeout=10)
        if r2.status_code == 200 and r2.json().get('success'):
            token = r2.json()['access_token']
            logged_in_email = reg_payload['email']
            ok(f'Registered & logged in as: {logged_in_email}')
        else:
            fail(f'Login after register failed: {r2.status_code} {r2.text}')
            sys.exit(1)
    except Exception as e:
        fail(f'Registration failed: {e}')
        traceback.print_exc()
        sys.exit(1)

HEADERS = {'Authorization': f'Bearer {token}'}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: POST to /report-disaster WITH image
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 3 -- POST /report-disaster (multipart with image)')
info('Sending: disaster_type=Flood, lat=17.3850, lng=78.4867')
info(f'Image  : {os.path.basename(TEST_IMG_PATH)}  ({os.path.getsize(TEST_IMG_PATH)/1024:.1f} KB)')

response_data = None
try:
    with open(TEST_IMG_PATH, 'rb') as f:
        files = {'images': ('upload_test_flood.jpg', f, 'image/jpeg')}
        form  = {
            'disaster_type': 'Flood',
            'description':   'API pipeline test -- flood scene image upload',
            'latitude':      '17.3850',
            'longitude':     '78.4867',
        }
        t0 = time.time()
        r  = requests.post(f'{BASE_URL}/report-disaster',
                           headers=HEADERS,
                           data=form,
                           files=files,
                           timeout=60)
        elapsed = time.time() - t0

    print(f'\n  HTTP Status : {r.status_code}')
    print(f'  Time taken  : {elapsed:.2f}s')

    if r.status_code in (200, 201):
        response_data = r.json()
        ok(f'Report submitted successfully')
        report = response_data.get('report', {})
        print()
        print(f'  Report ID           : {report.get("report_id")}')
        print(f'  Disaster Type       : {report.get("disaster_type")}')
        print(f'  Severity            : {report.get("severity")}')
        print(f'  Image Path          : {report.get("image_path")}')
        print()
        pred_type = report.get('predicted_disaster_type')
        pred_conf = report.get('prediction_confidence')
        print(f'  predicted_disaster_type : {pred_type}')
        print(f'  prediction_confidence   : {pred_conf}%')
        print()
        if pred_type and pred_type != 'Unknown' and pred_conf and float(pred_conf) > 0:
            ok(f'CNN PREDICTION RETURNED: {pred_type} ({pred_conf}%)')
        elif pred_type == 'Unknown':
            fail('CNN returned fallback "Unknown" -- model may have failed silently')
        else:
            warn('No prediction in response -- image may not have been processed')
    else:
        fail(f'API returned HTTP {r.status_code}')
        print(f'  Response: {r.text[:500]}')

except Exception as e:
    fail(f'POST request failed: {e}')
    traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Verify the file is saved on disk
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 4 -- Verify Saved File on Disk')

saved_path = None
if response_data:
    saved_path = response_data.get('report', {}).get('image_path')

if saved_path:
    info(f'API reported saved path: {saved_path}')
    if os.path.exists(saved_path):
        size_kb = os.path.getsize(saved_path) / 1024
        ok(f'File EXISTS on disk: {saved_path}  ({size_kb:.1f} KB)')
    else:
        fail(f'File NOT found on disk at: {saved_path}')
        # Check if maybe relative path
        alt = os.path.join(BACKEND, saved_path.lstrip('/\\'))
        if os.path.exists(alt):
            ok(f'Found at relative path: {alt}')
            saved_path = alt
        else:
            warn('File path from API does not match actual disk location')
else:
    warn('No image_path in response -- checking uploads/reports/ for new files')
    try:
        files_in_dir = sorted(
            [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith(('.jpg','.jpeg','.png'))],
            key=lambda f: os.path.getmtime(os.path.join(UPLOAD_DIR, f)),
            reverse=True
        )
        if files_in_dir:
            newest = os.path.join(UPLOAD_DIR, files_in_dir[0])
            age_s  = time.time() - os.path.getmtime(newest)
            if age_s < 60:
                ok(f'Found recent upload: {newest}  ({age_s:.0f}s ago)')
                saved_path = newest
            else:
                warn(f'Most recent file is {age_s:.0f}s old -- may not be from this test')
        else:
            warn('No image files found in uploads/reports/')
    except Exception as e:
        fail(f'Could not scan upload dir: {e}')

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Cross-check -- run predict_disaster() on the saved file
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 5 -- Direct Cross-check: predict_disaster() on Saved File')

try:
    from ai.disaster_classifier import predict_disaster, classifier_model, CLASSES
    info(f'classifier_model loaded: {classifier_model is not None}')

    if saved_path and os.path.exists(saved_path):
        ok(f'Running predict_disaster on: {saved_path}')
        t0     = time.time()
        result = predict_disaster(saved_path)
        ms     = (time.time() - t0) * 1000
        print()
        print(f'  Result       : {result}')
        print(f'  Inference ms : {ms:.1f}')
        print()
        if result['predicted_disaster_type'] != 'Unknown':
            ok(f'Cross-check PASSED: {result["predicted_disaster_type"]} ({result["confidence"]}%)')
        else:
            fail('Cross-check returned "Unknown" -- CNN may have failed on this image')
    else:
        warn('Skipped cross-check -- no valid saved file path')
except Exception as e:
    fail(f'Cross-check failed: {e}')
    traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: POST without image -- verify graceful handling
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 6 -- POST /report-disaster WITHOUT Image (graceful handling)')
try:
    form_only = {
        'disaster_type': 'Earthquake',
        'description':   'Test without image upload',
        'latitude':      '17.3850',
        'longitude':     '78.4867',
    }
    r2 = requests.post(f'{BASE_URL}/report-disaster',
                       headers=HEADERS, data=form_only, timeout=30)
    print(f'  HTTP Status: {r2.status_code}')
    d2 = r2.json()
    pred2 = d2.get('report', {}).get('predicted_disaster_type', 'N/A')
    conf2 = d2.get('report', {}).get('prediction_confidence', 'N/A')
    print(f'  predicted_disaster_type : {pred2}')
    print(f'  prediction_confidence   : {conf2}')
    if r2.status_code in (200, 201):
        ok('Report without image accepted (graceful -- prediction skipped)')
    else:
        warn(f'Unexpected status {r2.status_code}: {r2.text[:200]}')
except Exception as e:
    fail(f'No-image test failed: {e}')

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
banner('SUMMARY -- Image Upload to CNN Pipeline')
print()
print('  Pipeline: User Upload -> /report-disaster -> _save_file()')
print('            -> predict_disaster(img_path)  -> CNN.predict()')
print('            -> Response: predicted_disaster_type + confidence')
print()
if response_data:
    rpt = response_data.get('report', {})
    pred = rpt.get('predicted_disaster_type', 'N/A')
    conf = rpt.get('prediction_confidence', 'N/A')
    sev  = rpt.get('severity', 'N/A')
    print(f'  Report ID           : {rpt.get("report_id")}')
    print(f'  Predicted class     : {pred}')
    print(f'  Confidence          : {conf}%')
    print(f'  Severity            : {sev}')
    print()
    all_pass = (pred not in (None, 'Unknown', 'N/A')) and (conf not in (None, 0.0, 'N/A'))
    if all_pass:
        ok('PIPELINE FULLY WORKING -- image upload triggers CNN prediction correctly')
    else:
        fail('Pipeline has issues -- CNN prediction not returned correctly')
else:
    fail('No response data -- API call failed')
print()
