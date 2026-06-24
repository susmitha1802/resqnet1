# ResQNet — Disaster Relief Coordination Platform 🚨🌍

ResQNet is a comprehensive disaster relief and coordination platform designed to bridge the gap between reporters, volunteers, NGOs, and administrative authorities during critical emergencies. It leverages real-time map integration, predictive AI, and dynamic resource allocation to save lives efficiently.

## 🚀 Features

* **Multi-Role Dashboards:** Specialized interfaces for Reporters, Volunteers, NGOs, and Administrators.
* **Live GIS Mapping:** Real-time Leaflet/OpenStreetMap integration tracking SOS requests, volunteer locations, and disaster zone radii dynamically.
* **AI Disaster Classification:** An integrated Convolutional Neural Network (CNN) powered by TensorFlow automatically classifies disaster imagery (e.g., Cyclone, Earthquake, Flood, Wildfire) and outputs confidence scoring to rapidly inform relief priorities.
* **Smart SOS Workflows:** Reporters can broadcast geolocation-tagged requests (Food, Water, Shelter, Rescue) which are prioritized and routed to nearby volunteers.
* **Task Verification System:** Volunteers upload cryptographic or visual proof upon completing a rescue task, which administrators verify via a dedicated dashboard.
* **NGO Resource Allocation:** Dynamic inventory tracking and resource dispatching for large-scale relief groups.
* **Role-Based Access Control (RBAC):** Secure JWT authentication protecting sensitive endpoints and routes.

## 🛠️ Technology Stack

**Frontend:**
* HTML5 / CSS3 / Vanilla JavaScript
* Bootstrap 5 (Layout & Grid System)
* Leaflet & OpenStreetMap (Maps & Geospatial data - no API keys required)
* Chart.js (Admin Analytics Dashboard)

**Backend:**
* Python 3.x
* Flask & Flask RESTful Blueprints
* SQLAlchemy & Neon PostgreSQL (Database mapping and cloud storage)
* Flask-JWT-Extended (Authentication)
* bcrypt (Password Hashing)
* TensorFlow & Keras (AI Inference Model)
* Pillow (PIL) & Numpy (Image Preprocessing)

## ⚙️ Local Development Setup

### Prerequisites
* Python 3.9+
* Pip
* A Neon PostgreSQL Database (or local Postgres)

### 1. Clone & Configure Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up your environment variables:
   Copy `.env.example` to `.env` and fill in your Neon Database connection URL and custom JWT secret.
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the backend server:
   ```bash
   python app.py
   ```
   *The server will start locally at `http://127.0.0.1:5000`.*

### 2. Launch the Application
Simply open `frontend/index.html` in your favorite modern web browser, or serve the `frontend` folder using a simple HTTP server (e.g., `npx serve .` or `python -m http.server 8000`). No Google Maps API keys are required since the application leverages Leaflet.

## 📚 API Documentation
Once the Flask server is running, you can access the automatically generated interactive Swagger API documentation at:
**[http://127.0.0.1:5000/apidocs](http://127.0.0.1:5000/apidocs)**

## 🛡️ Security Considerations
* Ensure the `ADMIN_SECRET_CODE` environment variable is changed for production to prevent unauthorized admin registrations.
* The frontend currently relies on `localStorage` for JWT persistence. For production scaling, consider migrating auth tokens to `HttpOnly` Secure cookies to mitigate XSS vulnerabilities.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
