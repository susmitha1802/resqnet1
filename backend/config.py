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

    # Database — MySQL
    MYSQL_HOST     = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER     = os.getenv('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
    MYSQL_DB       = os.getenv('MYSQL_DB', 'resqnet')

    # ── Database ──────────────────────────────────────────────────────────────
    # SQLite (default — zero setup, works immediately)
    SQLALCHEMY_DATABASE_URI = 'sqlite:///resqnet.db'

    # To switch to MySQL, comment the line above and uncomment below,
    # then set MYSQL_PASSWORD in your .env file:
    # SQLALCHEMY_DATABASE_URI = (
    #     f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}"
    # )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY       = os.getenv('JWT_SECRET_KEY', 'jwt-secret-resqnet')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours

    # File uploads
    UPLOAD_FOLDER   = os.path.join(os.path.dirname(__file__), 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov'}

    # CORS
    CORS_ORIGINS = ['http://127.0.0.1:5500', 'http://localhost:5500',
                    'http://127.0.0.1:5501', 'http://localhost:5501',
                    'http://127.0.0.1:3000', 'http://localhost:3000',
                    'null']  # for file:// protocol during dev
