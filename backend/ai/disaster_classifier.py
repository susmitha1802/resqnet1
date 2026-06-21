import os
import numpy as np
import logging

logger = logging.getLogger(__name__)

# Try to import tensorflow and keras, fallback gracefully if not available
try:
    import tensorflow as tf  # type: ignore
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
CLASSES = ['Cyclone', 'Earthquake', 'Flood', 'Wildfire']

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

def predict_disaster(image_path):
    """
    Predicts the disaster type from an image using the loaded AI model.
    Returns a dictionary with 'predicted_disaster_type' and 'confidence'.
    Falls back gracefully to 'Unknown' if prediction fails.
    """
    fallback_result = {
        "predicted_disaster_type": "Unknown",
        "confidence": 0.0
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

        # Map to class name
        predicted_class = CLASSES[pred_index]

        return {
            "predicted_disaster_type": predicted_class,
            "confidence": round(confidence, 2)
        }

    except Exception as e:
        logger.error(f"Error during AI disaster prediction: {e}")
        return fallback_result
