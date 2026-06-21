"""
ResQNet -- Direct CNN Model Inference Test
==========================================
Bypasses UI, API, and database entirely.
Loads disaster_classifier.py directly and runs
inference on multiple synthetic test images.

Run:  python test_model_direct.py
"""
import os
import sys
import time
import traceback
import numpy as np

# Force UTF-8 output to avoid Windows CP1252 crashes
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# ── Setup path so we can import from backend/ai ───────────────────────────────
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
AI_DIR      = os.path.join(BACKEND_DIR, 'ai')
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, AI_DIR)

SCRATCH_DIR = os.path.join(BACKEND_DIR, 'uploads', 'test_scratch')
os.makedirs(SCRATCH_DIR, exist_ok=True)

SEP  = '=' * 70
SEP2 = '-' * 70

def banner(title):
    print('\n' + SEP)
    print('  ' + title)
    print(SEP)

def ok(msg):  print('[PASS] ' + msg)
def fail(msg): print('[FAIL] ' + msg)
def warn(msg): print('[WARN] ' + msg)
def info(msg): print('       ' + msg)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: TensorFlow import
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 1 -- TensorFlow Import Check')
TF_OK = False
tf = load_model = keras_image = None
try:
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing import image as keras_image
    ok(f'TensorFlow version  : {tf.__version__}')
    ok(f'Keras version       : {tf.keras.__version__}')
    TF_OK = True
except Exception as e:
    fail(f'TensorFlow FAILED to import: {e}')
    traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Load model directly
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 2 -- Raw Model Load (disaster.h5)')
MODEL_PATH = os.path.join(AI_DIR, 'disaster.h5')
CLASSES    = ['Cyclone', 'Earthquake', 'Flood', 'Wildfire']
raw_model  = None

if TF_OK:
    if not os.path.exists(MODEL_PATH):
        fail(f'Model NOT found at: {MODEL_PATH}')
    else:
        file_kb = os.path.getsize(MODEL_PATH) // 1024
        info(f'Path      : {MODEL_PATH}')
        info(f'File size : {file_kb} KB')
        try:
            t0 = time.time()
            raw_model = load_model(MODEL_PATH)
            elapsed   = time.time() - t0
            ok(f'Model loaded in {elapsed:.2f}s')
            info(f'Input  shape : {raw_model.input_shape}')
            info(f'Output shape : {raw_model.output_shape}')
            info(f'Classes      : {CLASSES}')
            info(f'Total params : {raw_model.count_params():,}')
        except Exception as e:
            fail('Model load FAILED:')
            traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Import disaster_classifier module
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 3 -- Import disaster_classifier module')
dc = None
try:
    import disaster_classifier as dc
    ok(f'Module imported successfully')
    info(f'TF_AVAILABLE     : {dc.TF_AVAILABLE}')
    info(f'classifier_model : {"LOADED" if dc.classifier_model is not None else "None (FAILED)"}')
    info(f'CLASSES          : {dc.CLASSES}')
except Exception as e:
    fail('Import FAILED:')
    traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Generate synthetic test images (64x64 PNG)
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 4 -- Generate Synthetic Test Images (64x64 PNG)')
IMG_OK     = False
test_images = {}

try:
    from PIL import Image

    def make_image(name, r, g, b, noise=0.15):
        """Create a 64x64 solid-colour + noise PNG and return its path."""
        base = np.ones((64, 64, 3), dtype=np.float32)
        base[:, :, 0] = r / 255.0
        base[:, :, 1] = g / 255.0
        base[:, :, 2] = b / 255.0
        noise_arr = np.random.normal(0, noise, (64, 64, 3))
        base = np.clip(base + noise_arr, 0, 1)
        arr  = (base * 255).astype(np.uint8)
        path = os.path.join(SCRATCH_DIR, name + '.png')
        Image.fromarray(arr).save(path)
        size = os.path.getsize(path)
        ok(f'{name:24s} -> {path}  ({size:,} bytes)')
        return path

    # Colour hints for each class (model decides the actual output)
    test_images = {
        'flood_blue'      : make_image('flood_blue',         0,  80, 200),
        'wildfire_orange' : make_image('wildfire_orange',  220,  80,   0),
        'cyclone_grey'    : make_image('cyclone_grey',     130, 140, 160),
        'earthquake_dark' : make_image('earthquake_dark',   80,  60,  40),
    }
    IMG_OK = True

except Exception as e:
    fail('Image generation FAILED (Pillow not installed?):')
    traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Raw model.predict() on each image
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 5 -- Raw model.predict() on each test image')

if not TF_OK:
    warn('Skipped -- TensorFlow not available')
elif raw_model is None:
    warn('Skipped -- model failed to load')
elif not IMG_OK:
    warn('Skipped -- images not generated')
else:
    all_ok = True
    for label, img_path in test_images.items():
        print('\n' + SEP2)
        print(f'Image         : {label}')
        print(f'Path          : {img_path}')
        try:
            img  = keras_image.load_img(img_path, target_size=(64, 64))
            x    = keras_image.img_to_array(img)
            x    = x / 255.0
            x    = np.expand_dims(x, axis=0)

            t0   = time.time()
            preds = raw_model.predict(x, verbose=0)
            ms   = (time.time() - t0) * 1000

            pred_index  = int(np.argmax(preds[0]))
            confidence  = float(np.max(preds[0]) * 100)
            pred_class  = CLASSES[pred_index]

            print(f'Inference time: {ms:.1f} ms')
            print(f'Raw output    : [{", ".join(f"{v:.6f}" for v in preds[0])}]')
            print()
            print(f'  {"Class":<14}  {"Probability":>12}  {"Bar":<32}  Note')
            print(f'  {"-"*14}  {"-"*12}  {"-"*32}  {"-"*10}')
            for i, cls in enumerate(CLASSES):
                bar    = '#' * int(preds[0][i] * 40)
                note   = '<-- PREDICTED' if i == pred_index else ''
                print(f'  {cls:<14}  {preds[0][i]:>12.6f}  {bar:<32}  {note}')
            print()
            ok(f'Predicted: {pred_class}  (confidence: {confidence:.2f}%)')

        except Exception as e:
            fail(f'INFERENCE FAILED on {label}:')
            traceback.print_exc()
            all_ok = False

    if all_ok:
        print('\n' + SEP2)
        ok('All 4 raw inference tests passed')

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Test predict_disaster() wrapper function
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 6 -- predict_disaster() wrapper function')

if dc is None:
    warn('Skipped -- module not imported')
elif not IMG_OK:
    warn('Skipped -- images not generated')
else:
    for label, img_path in test_images.items():
        print(f'  {label}')
        try:
            result = dc.predict_disaster(img_path)
            if result['predicted_disaster_type'] == 'Unknown' and result['confidence'] == 0.0:
                warn(f'  Returned fallback dict -- model may not be loaded inside module')
            else:
                ok(f'  => {result["predicted_disaster_type"]}  ({result["confidence"]}%)')
        except Exception as e:
            fail(f'  EXCEPTION:')
            traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Existing upload stub files (expected to fail / fallback)
# ─────────────────────────────────────────────────────────────────────────────
banner('STEP 7 -- Existing uploaded stub files (expect fallback)')

stub_files = [
    os.path.join(BACKEND_DIR, 'uploads', 'reports', 'dummy_disaster.png'),
    os.path.join(BACKEND_DIR, 'uploads', 'reports', 'test_disaster.png'),
]

if dc is None:
    warn('Skipped -- module not imported')
else:
    for stub in stub_files:
        fname  = os.path.basename(stub)
        exists = os.path.exists(stub)
        size   = os.path.getsize(stub) if exists else 0
        status = 'EXISTS' if exists else 'MISSING'
        print(f'\n  {fname}  ({size} bytes)  [{status}]')
        if exists and size < 500:
            warn('  File is too small to be a valid image (stub/placeholder)')
        if exists:
            result = dc.predict_disaster(stub)
            print(f'  Result: {result}')
        else:
            warn('  File missing -- skipping prediction')

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
banner('SUMMARY')
rows = [
    ('TensorFlow available',           TF_OK),
    ('disaster.h5 raw load',           raw_model is not None),
    ('disaster_classifier imported',   dc is not None),
    ('Module classifier_model loaded', dc is not None and dc.classifier_model is not None),
    ('Synthetic images generated',     IMG_OK),
]
for label, passed in rows:
    marker = '[PASS]' if passed else '[FAIL]'
    print(f'  {marker}  {label}')

print()
if IMG_OK:
    print(f'  Synthetic images : {SCRATCH_DIR}')
print()
