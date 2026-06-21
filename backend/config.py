"""
ResQNet — Flask Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'resqnet-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_DEBUG', 'True') == 'True'

    # ── Database Configuration ──
    # The application strictly relies on the DATABASE_URL environment variable.
    # Neon PostgreSQL Example: postgresql+psycopg2://user:password@host/dbname?sslmode=require
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///resqnet.db')

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY           = os.getenv('JWT_SECRET_KEY', 'jwt-secret-resqnet')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours

    # File uploads
    UPLOAD_FOLDER      = os.path.join(os.path.dirname(__file__), os.getenv('UPLOAD_FOLDER', 'uploads'))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 10 * 1024 * 1024))  # 10 MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'webp', 'heic', 'svg'}

    # CORS
    _cors = os.getenv('CORS_ORIGINS', 'http://127.0.0.1:5500,http://localhost:5500,*')
    CORS_ORIGINS = [o.strip() for o in _cors.split(',')]

    # Maps & Geocoding (Currently Leaflet + Nominatim are free, but keys can be provided for Mapbox/LocationIQ)
    MAP_PROVIDER = os.getenv('MAP_PROVIDER', 'leaflet')
    LOCATION_API_KEY = os.getenv('LOCATION_API_KEY', '')
