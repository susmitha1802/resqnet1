-- ResQNet Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS resqnet;
USE resqnet;

-- ── Users Table ──
CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    phone       VARCHAR(20)  NOT NULL,
    password    VARCHAR(255) NOT NULL,      -- bcrypt hash
    role        ENUM('victim','volunteer','admin') NOT NULL DEFAULT 'victim',
    skills      TEXT,                        -- JSON array for volunteers
    location    VARCHAR(200),               -- volunteer area
    availability ENUM('available','unavailable') DEFAULT 'available',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Disaster Reports Table ──
CREATE TABLE IF NOT EXISTS disaster_reports (
    report_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    disaster_type ENUM('Flood','Cyclone','Earthquake','Landslide','Fire') NOT NULL,
    description  TEXT NOT NULL,
    image_path   VARCHAR(500),
    severity     ENUM('Low Damage','Moderate Damage','Severe Damage') DEFAULT 'Moderate Damage',
    latitude     DECIMAL(10,6) NOT NULL,
    longitude    DECIMAL(10,6) NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Help Requests Table ──
CREATE TABLE IF NOT EXISTS help_requests (
    request_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(120) NOT NULL,
    contact         VARCHAR(20)  NOT NULL,
    request_type    ENUM('Food','Water','Medicine','Rescue','Shelter') NOT NULL,
    priority_level  ENUM('High','Medium','Low') NOT NULL DEFAULT 'Medium',
    number_of_people INT NOT NULL DEFAULT 1,
    description     TEXT,
    image_path      VARCHAR(500),
    is_duplicate    BOOLEAN DEFAULT FALSE,
    status          ENUM('Pending','Accepted','En Route','On Site','Completed','Duplicate') DEFAULT 'Pending',
    latitude        DECIMAL(10,6) NOT NULL,
    longitude       DECIMAL(10,6) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Volunteers Table ──
CREATE TABLE IF NOT EXISTS volunteers (
    volunteer_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE,
    availability_status ENUM('available','unavailable','on_task') DEFAULT 'available',
    assigned_tasks    INT DEFAULT 0,
    completed_tasks   INT DEFAULT 0,
    rating            DECIMAL(3,2) DEFAULT 5.00,
    last_location_lat DECIMAL(10,6),
    last_location_lng DECIMAL(10,6),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Relief Tasks Table ──
CREATE TABLE IF NOT EXISTS relief_tasks (
    task_id       INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id  INT NOT NULL,
    request_id    INT NOT NULL,
    status        ENUM('Assigned','En Route','On Site','Completed','Cancelled') DEFAULT 'Assigned',
    assigned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at  TIMESTAMP,
    notes         TEXT,
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE CASCADE,
    FOREIGN KEY (request_id)   REFERENCES help_requests(request_id) ON DELETE CASCADE
);

-- ── Indexes ──
CREATE INDEX idx_requests_status    ON help_requests(status);
CREATE INDEX idx_requests_priority  ON help_requests(priority_level);
CREATE INDEX idx_requests_location  ON help_requests(latitude, longitude);
CREATE INDEX idx_reports_type       ON disaster_reports(disaster_type);
CREATE INDEX idx_volunteers_status  ON volunteers(availability_status);

-- ── Sample Admin User (password: admin123) ──
INSERT INTO users (name, email, phone, password, role)
VALUES ('Admin Officer', 'admin@resqnet.in', '9876543210',
        '$2b$12$2yqRX0CW0XRuHqVJn5KK5OSi.q/TLCDPhm6R3kKJXO6rFXEGrUWMG', 'admin');
