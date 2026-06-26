import os
import numpy as np
import logging

logger = logging.getLogger(__name__)

# Try to import tensorflow and keras, fallback gracefully if not available
try:
    from tensorflow.keras.models import load_model  # type: ignore
    from tensorflow.keras.preprocessing import image  # type: ignore
    TF_AVAILABLE = True
except ImportError as e:
    logger.error(f"TensorFlow is not available. AI disaster classification will be disabled. Error: {e}")
    TF_AVAILABLE = False
    load_model = None  # type: ignore
    image = None  # type: ignore

# Path to the trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'disaster.h5')

# Raw class labels the model was trained on, in output-index order.
# Do NOT reorder this list — it must match the model's training order.
RAW_CLASSES = ['Cyclone', 'Earthquake', 'Flood', 'Wildfire']

# The frontend / DisasterReport.disaster_type enum uses "Fire", not "Wildfire",
# and additionally offers "Landslide", which this model was never trained to
# recognize. This map translates raw model output into the same vocabulary
# used everywhere else in the app, without requiring any retraining.
LABEL_DISPLAY_MAP = {
    'Wildfire': 'Fire',
}

# Disaster types the CNN can actually distinguish, in the app's own vocabulary.
# Used by callers to decide whether to trust/run a prediction for a given
# user-selected disaster_type (e.g. "Landslide" has no model support).
SUPPORTED_DISASTER_TYPES = sorted({LABEL_DISPLAY_MAP.get(c, c) for c in RAW_CLASSES})

# Load the model globally so it's only loaded once when the application starts
classifier_model = None
if TF_AVAILABLE and load_model is not None:
    try:
        if os.path.exists(MODEL_PATH):
            classifier_model = load_model(MODEL_PATH)
            logger.info("Successfully loaded AI disaster classification model.")
        else:
            logger.error(f"Model file not found at {MODEL_PATH}. AI disaster classification will be disabled.")
    except Exception as e:
        logger.error(f"Failed to load AI model. Error: {e}")


def model_supports_type(disaster_type: str | None) -> bool:
    """
    Returns True if the CNN was trained to recognize the given disaster_type
    (in the app's own vocabulary, e.g. 'Fire' not 'Wildfire').
    """
    return disaster_type in SUPPORTED_DISASTER_TYPES


def predict_disaster(image_path, reported_disaster_type: str | None = None):
    """
    Predicts the disaster type from an image using the loaded AI model.
    Returns a dictionary with 'predicted_disaster_type', 'confidence', and
    'note' (set when the prediction may not be meaningful — e.g. the model
    was never trained on the type of disaster the user actually selected).
    Falls back gracefully to 'Unknown' if prediction fails.
    """
    fallback_result = {
        "predicted_disaster_type": "Unknown",
        "confidence": 0.0,
        "note": None,
    }

    # If the user explicitly reported a disaster type the model was never
    # trained to recognize (e.g. Landslide), don't silently run the model
    # and present a meaningless/misleading "Unknown" — make this explicit
    # instead, so the UI can show "not supported" rather than implying a
    # failed/low-confidence prediction.
    if reported_disaster_type is not None and not model_supports_type(reported_disaster_type):
        return {
            "predicted_disaster_type": None,
            "confidence": None,
            "note": (
                f"AI image classification is not yet available for '{reported_disaster_type}'. "
                f"Currently supported types: {', '.join(SUPPORTED_DISASTER_TYPES)}."
            ),
        }

    if not TF_AVAILABLE or classifier_model is None or image is None:
        return fallback_result

    try:
        if not os.path.exists(image_path):
            logger.error(f"Image not found at {image_path}")
            return fallback_result

        # Load the image and resize it to 64x64 as expected by the model
        img = image.load_img(image_path, target_size=(64, 64))
        
        # Convert image to numpy array
        x = image.img_to_array(img)
        
        # Rescale pixel values (1./255) to match the training preprocessing
        x = x / 255.0
        
        # Expand dimensions to match the input shape (1, 64, 64, 3)
        x = np.expand_dims(x, axis=0)

        # Make prediction
        prediction = classifier_model.predict(x)
        
        # Get the predicted class index
        pred_index = np.argmax(prediction[0])
        
        # Get the confidence percentage
        confidence = float(np.max(prediction[0]) * 100)

        # Map to class name, translated into the app's own disaster-type vocabulary
        raw_class = RAW_CLASSES[pred_index]
        predicted_class = LABEL_DISPLAY_MAP.get(raw_class, raw_class)

        return {
            "predicted_disaster_type": predicted_class,
            "confidence": round(confidence, 2),
            "note": None,
        }

    except Exception as e:
        logger.error(f"Error during AI disaster prediction: {e}")
        return fallback_result
