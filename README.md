# ResQNet — Disaster Relief Coordination Platform 🚨🌍

ResQNet is a comprehensive disaster relief and coordination platform designed to bridge the gap between victims, volunteers, NGOs, and administrative authorities during critical emergencies. It leverages real-time map integration, predictive damage assessment AI, and dynamic resource allocation to save lives efficiently.

## 🚀 Features

* **Multi-Role Dashboards:** Specialized interfaces for Victims, Volunteers, NGOs, and Administrators.
* **Live GIS Mapping:** Real-time Google Maps integration tracking SOS requests, volunteer locations, and disaster zone radii dynamically (`AdvancedMarkerElement`).
* **Damage Severity AI:** Automated heuristic assessment categorizing uploaded disaster imagery into Severe, Moderate, or Low impact zones.
* **Smart SOS Workflows:** Victims can broadcast geolocation-tagged requests (Food, Water, Shelter, Rescue) which are prioritized and routed to nearby volunteers.
* **NGO Resource Allocation:** Dynamic inventory tracking and resource dispatching for large-scale relief groups.
* **Role-Based Access Control (RBAC):** Secure JWT authentication protecting sensitive endpoints and routes.

## 🛠️ Technology Stack

**Frontend:**
* HTML5 / CSS3 / Vanilla JavaScript
* Bootstrap 5 (Layout & Grid System)
* Google Maps JavaScript API (Maps & Geospatial data)
* Chart.js (Admin Analytics Dashboard)

**Backend:**
* Python 3.x
* Flask & Flask RESTful Blueprints
* SQLAlchemy (SQLite Database mapping)
* Flask-JWT-Extended (Authentication)
* bcrypt (Password Hashing)
* Flasgger (Swagger OpenAPI Documentation)
* Pillow (PIL) & Numpy (AI Imagery Heuristics)

## ⚙️ Local Development Setup

### Prerequisites
* Python 3.9+
* Pip
* Google Maps API Key

### 1. Clone & Configure Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the backend server:
   ```bash
   python app.py
   ```
   *The server will start locally at `http://127.0.0.1:5000`.*

### 2. Configure Frontend Maps (API Key)
Google Maps requires an API Key to render map tiles and custom `AdvancedMarkerElement` pins.
1. Open `frontend/map.html`, `frontend/volunteer-dashboard.html`, and `frontend/ngo-dashboard.html`.
2. Locate the Google Maps script tag:
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&callback=init..."></script>
   ```
3. Replace `YOUR_API_KEY_HERE` with your actual Google Maps API Key.

### 3. Launch the Application
Simply open `frontend/index.html` in your favorite modern web browser, or serve the `frontend` folder using a simple HTTP server (e.g., `npx serve .` or `python -m http.server 8000`).

## 📚 API Documentation
Once the Flask server is running, you can access the automatically generated interactive Swagger API documentation at:
**[http://127.0.0.1:5000/apidocs](http://127.0.0.1:5000/apidocs)**

## 🛡️ Security Considerations
* Ensure the `ADMIN_SECRET_CODE` environment variable is changed for production to prevent unauthorized admin registrations.
* The frontend currently relies on `localStorage` for JWT persistence. For production scaling, consider migrating auth tokens to `HttpOnly` Secure cookies to mitigate XSS vulnerabilities.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
