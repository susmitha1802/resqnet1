
# ResQNet – AI-Powered Disaster Preparedness and Response Coordination Platform

ResQNet is a comprehensive disaster relief and coordination platform designed to bridge the gap between citizens, volunteers, NGOs, and administrative authorities during critical emergencies. It leverages real-time map integration, predictive AI, live weather data, and dynamic resource allocation to streamline emergency response and save lives efficiently.

### Key Features
* **Live GIS Mapping**: Real-time Leaflet/OpenStreetMap integration tracking SOS requests, volunteer locations, and dynamic disaster risk zones.
* **Smart SOS Workflows**: Geolocation-tagged help requests (Rescue, Food, Water, Medicine, Shelter) routed to nearby volunteers.
* **Task Verification System**: Volunteers upload proof of completion, which administrators verify via a dedicated dashboard.
* **Role-Based Access Control**: Secure JWT authentication isolating capabilities by user role.

### User Roles
* **Citizens (Reporters)**: Report disasters, request emergency help, and track request status.
* **Volunteers**: Receive localized alerts, accept rescue/relief tasks, and upload completion proof.
* **NGOs**: Manage relief inventories, allocate resources to specific requests, and coordinate organizational readiness.
* **Administrators (EOC)**: Validate disaster reports, manage risk zones, trigger preparedness pings, and oversee system analytics.

### System Workflow
1. A disaster is reported by a citizen.
2. The AI module classifies the disaster imagery and estimates severity.
3. Authorities verify the report and establish a risk zone on the operational map.
4. An emergency preparedness alert is pushed to all nearby NGOs and Volunteers.
5. Citizens submit SOS requests, which are fulfilled by the mobilized responders.

### AI Disaster Classification
ResQNet features an integrated Convolutional Neural Network (CNN) powered by TensorFlow. It automatically classifies disaster imagery into categories (e.g., Cyclone, Earthquake, Flood, Fire) and outputs confidence scoring to rapidly inform relief priorities and filter out false reports.

### Live Weather Intelligence
The platform integrates with OpenWeatherMap to pull real-time meteorological data and forecasting. This ensures that responders are aware of immediate atmospheric conditions (temperature, wind speeds, humidity) before deploying into hazardous areas.

### Disaster Preparedness
Before extreme weather strikes, the Preparedness Center allows administrators to ping all registered responders within a projected impact radius. Responders can acknowledge these alerts and confirm their readiness to deploy, giving the EOC an accurate measure of available capacity.

### Operational Risk Map
A dynamic geospatial interface that visualizes:
* Active disaster zones and calculated risk radii.
* Real-time locations of SOS requests and their priorities.
* NGO depots and available relief inventories.
* Safe staging areas for rapid deployment.

### Installation

**Prerequisites**:
* Python 3.9+
* Pip

**Steps**:
1. Clone the repository and navigate to the project directory.
2. Create your `.env` file from the example template:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Install the required Python dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python app.py
   ```
5. Open `frontend/index.html` in your browser, or serve the directory using any HTTP server (e.g. `npx serve frontend`).
>>>>>>> 3007145 (Fix workflow)
