"""
ResQNet — Auth Routes Blueprint
POST /register  — create account (reporter / volunteer / ngo / admin)
POST /login     — authenticate and receive JWT
GET  /profile   — get current user profile
POST /seed-demo-users — (DEBUG only) seed demo accounts into DB
"""
import os
import bcrypt
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from extensions import db
from models import User, Volunteer

auth_bp = Blueprint('auth', __name__)

# Admin secret code (set ADMIN_SECRET_CODE in .env to override)
ADMIN_SECRET_CODE = os.getenv('ADMIN_SECRET_CODE', 'RESQNET_ADMIN_2024')

VALID_ROLES = ('reporter', 'volunteer', 'ngo', 'admin')


def _success(data=None, message='OK', status=200):
    return jsonify({'success': True, 'message': message, **(data or {})}), status


def _error(message='Error', status=400):
    return jsonify({'success': False, 'message': message}), status


# ── POST /register ─────────────────────────────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    phone    = data.get('phone', '').strip()
    password = data.get('password', '')
    role     = data.get('role', 'reporter').strip().lower()

    # ── Validation ─────────────────────────────────────────────────────────────
    if not all([name, email, phone, password]):
        return _error('All fields are required (name, email, phone, password)')
    if len(password) < 6:
        return _error('Password must be at least 6 characters')
    if role not in VALID_ROLES:
        return _error(f'Invalid role. Must be one of: {", ".join(VALID_ROLES)}')
    if User.query.filter_by(email=email).first():
        return _error('Email already registered', 409)

    # ── Admin secret code check ─────────────────────────────────────────────────
    if role == 'admin':
        provided_code = data.get('admin_secret_code', '').strip()
        if provided_code != ADMIN_SECRET_CODE:
            return _error('Invalid admin secret code. Admin registration is restricted.', 403)

    # ── Hash password ──────────────────────────────────────────────────────────
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # ── Create user ────────────────────────────────────────────────────────────
    import json
    user = User(name=name, email=email, phone=phone, password=hashed, role=role)

    if role == 'volunteer':
        user.skills       = json.dumps(data.get('skills', []))
        user.location     = data.get('location', '')
        user.availability = data.get('availability', 'available')

    if role == 'ngo':
        # Store NGO org name in the location field, skills stores org type
        user.location = data.get('org_name', '').strip()
        user.skills   = json.dumps({'org_type': data.get('org_type', 'NGO'), 'area': data.get('area', '')})

    db.session.add(user)
    db.session.flush()   # get user_id before commit

    if role == 'volunteer':
        vol = Volunteer(user_id=user.user_id)
        db.session.add(vol)

    db.session.commit()

    token = create_access_token(identity=str(user.user_id))
    return _success(
        {'token': token, 'user': user.to_dict()},
        'Account created successfully',
        201
    )


# ── POST /login ────────────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}

    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return _error('Email and password are required')

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return _error('Invalid email or password', 401)

    token = create_access_token(identity=str(user.user_id))
    return _success({
        'token': token,
        'role':  user.role,       # Explicit role field for easy frontend use
        'user':  user.to_dict()
    })


# ── GET /profile ───────────────────────────────────────────────────────────────
@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    uid  = int(get_jwt_identity())
    user = db.get_or_404(User, uid)
    return _success({'user': user.to_dict()})


# ── POST /seed-demo-users (DEBUG ONLY) ────────────────────────────────────────
@auth_bp.route('/seed-demo-users', methods=['POST'])
def seed_demo_users():
    """
    Create demo accounts in the database for testing.
    Only available in DEBUG mode.

    Demo accounts created:
      user@demo.com    / demo123  → reporter
      vol@demo.com     / demo123  → volunteer
      ngo@demo.com     / demo123  → ngo
      admin@demo.com   / admin123 → admin
    """
    import json
    if not current_app.config.get('DEBUG', False):
        return _error('Seed endpoint is only available in DEBUG mode', 403)

    demo_users = [
        {
            'name': 'Susmitha Reddy',
            'email': 'user@demo.com',
            'phone': '9876543210',
            'password': 'demo123',
            'role': 'reporter',
        },
        {
            'name': 'Arjun Kumar',
            'email': 'vol@demo.com',
            'phone': '9876543211',
            'password': 'demo123',
            'role': 'volunteer',
            'skills': json.dumps(['First Aid', 'Driving', 'Search & Rescue']),
            'location': 'Kukatpally, Hyderabad',
        },
        {
            'name': 'Relief India Foundation',
            'email': 'ngo@demo.com',
            'phone': '9876543213',
            'password': 'demo123',
            'role': 'ngo',
            'location': 'Relief India Foundation',
            'skills': json.dumps({'org_type': 'Disaster Relief NGO', 'area': 'Hyderabad'}),
        },
        {
            'name': 'Admin Officer',
            'email': 'admin@demo.com',
            'phone': '9876543212',
            'password': 'admin123',
            'role': 'admin',
        },
    ]

    created = []
    skipped = []

    for u in demo_users:
        if User.query.filter_by(email=u['email']).first():
            skipped.append(u['email'])
            continue

        hashed = bcrypt.hashpw(u['password'].encode(), bcrypt.gensalt()).decode()
        user = User(
            name=u['name'],
            email=u['email'],
            phone=u['phone'],
            password=hashed,
            role=u['role'],
            skills=u.get('skills'),
            location=u.get('location'),
        )
        db.session.add(user)
        db.session.flush()

        if u['role'] == 'volunteer':
            vol = Volunteer(user_id=user.user_id)
            db.session.add(vol)

        created.append(u['email'])

    db.session.commit()

    return _success({
        'created': created,
        'skipped': skipped,
        'credentials': [
            {'email': 'user@demo.com',  'password': 'demo123',  'role': 'reporter'},
            {'email': 'vol@demo.com',   'password': 'demo123',  'role': 'volunteer'},
            {'email': 'ngo@demo.com',   'password': 'demo123',  'role': 'ngo'},
            {'email': 'admin@demo.com', 'password': 'admin123', 'role': 'admin'},
        ]
    }, f'Seeded {len(created)} users (skipped {len(skipped)} existing)')
