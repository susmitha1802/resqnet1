"""
ResQNet — Help Requests Routes Blueprint
POST /help-request          — submit SOS (reporter only)
GET  /help-requests         — list requests (role-filtered)
GET  /help-request/<id>     — get single request
PUT  /help-request/status   — update status (volunteer/admin/ngo)
"""
import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import User, HelpRequest, Volunteer, ReliefTask
from ai.priority  import predict_priority
from ai.duplicate import detect_duplicate
from ai.severity  import classify_severity
from routes.middleware import require_role, require_any_role

help_bp = Blueprint('help_requests', __name__)


def _success(data=None, message='OK', status=200):
    return jsonify({'success': True, 'message': message, **(data or {})}), status


def _error(message='Error', status=400):
    return jsonify({'success': False, 'message': message}), status


def _save_file(file_obj, subfolder: str) -> str | None:
    if not file_obj or not file_obj.filename:
        return None
    ext = file_obj.filename.rsplit('.', 1)[-1].lower()
    if ext not in current_app.config['ALLOWED_EXTENSIONS']:
        return None
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, secure_filename(file_obj.filename))
    file_obj.save(path)
    return path


# ── POST /help-request ─────────────────────────────────────────────────────────
@help_bp.route('/help-request', methods=['POST'])
@require_role('reporter')   # Only reporters can submit help requests
def create_help_request():
    uid  = int(get_jwt_identity())
    data = request.form

    name         = data.get('name', '').strip()
    contact      = data.get('contact', '').strip()
    request_type = data.get('request_type', '').strip()
    people_raw   = data.get('number_of_people', '1')
    description  = data.get('description', '').strip()

    lat_val = data.get('latitude')
    lng_val = data.get('longitude')
    if lat_val is None or lng_val is None:
        return _error('Invalid latitude, longitude, or number_of_people')

    try:
        latitude  = float(lat_val)
        longitude = float(lng_val)
        people    = max(1, int(people_raw))
    except (TypeError, ValueError):
        return _error('Invalid latitude, longitude, or number_of_people')

    if not all([name, contact, request_type]):
        return _error('name, contact, and request_type are required')

    if len(name) > 100:
        return _error('Name must be 100 characters or fewer')
    if len(description) > 2000:
        return _error('Description must be 2000 characters or fewer')

    valid_types = ('Food', 'Water', 'Medicine', 'Rescue', 'Shelter')
    if request_type not in valid_types:
        return _error(f'request_type must be one of {valid_types}')

    # ── AI: Priority Prediction ──────────────────────────────────────────────
    priority = predict_priority(request_type, people)

    # ── AI: Duplicate Detection ──────────────────────────────────────────────
    active_requests = HelpRequest.query.filter(
        HelpRequest.status.in_(['Pending', 'Accepted'])
    ).all()
    is_dup = detect_duplicate(
        {'request_type': request_type, 'latitude': latitude, 'longitude': longitude},
        active_requests
    )

    # ── Upload image ─────────────────────────────────────────────────────────
    img_path = None
    if 'image' in request.files:
        img_path = _save_file(request.files['image'], 'requests')

    # ── AI: Damage Severity (if image provided) ───────────────────────────────
    severity = classify_severity(image_path=img_path) if img_path else None

    # ── Persist ───────────────────────────────────────────────────────────────
    req = HelpRequest(
        user_id          = uid,
        name             = name,
        contact          = contact,
        request_type     = request_type,
        priority_level   = priority,
        number_of_people = people,
        description      = description,
        image_path       = img_path,
        is_duplicate     = is_dup,
        status           = 'Duplicate' if is_dup else 'Pending',
        latitude         = latitude,
        longitude        = longitude,
    )
    db.session.add(req)
    db.session.commit()

    return _success(
        {
            'request': req.to_dict(),
            'ai': {
                'priority':     priority,
                'is_duplicate': is_dup,
                'severity':     severity,
            }
        },
        'Help request submitted successfully',
        201
    )


# ── GET /help-requests ─────────────────────────────────────────────────────────
@help_bp.route('/help-requests', methods=['GET'])
@require_any_role(['reporter', 'volunteer', 'ngo', 'admin'])
def get_help_requests():
    uid  = int(get_jwt_identity())
    user = db.get_or_404(User, uid)

    if user.role == 'admin':
        # Admins see ALL requests
        reqs = HelpRequest.query.order_by(HelpRequest.created_at.desc()).all()

    elif user.role in ('volunteer', 'ngo'):
        # Volunteers and NGOs see all pending requests sorted by priority
        from sqlalchemy import case as sa_case
        priority_order = sa_case(
            (HelpRequest.priority_level == 'High',   1),
            (HelpRequest.priority_level == 'Medium', 2),
            else_=3
        )
        reqs = (
            HelpRequest.query
            .filter_by(status='Pending')
            .order_by(priority_order, HelpRequest.created_at.asc())
            .all()
        )

    else:
        # Reporters see only their own requests
        reqs = (
            HelpRequest.query
            .filter_by(user_id=uid)
            .order_by(HelpRequest.created_at.desc())
            .all()
        )

    return _success({'requests': [r.to_dict() for r in reqs], 'total': len(reqs)})


# ── GET /help-request/<id> ─────────────────────────────────────────────────────
@help_bp.route('/help-request/<int:req_id>', methods=['GET'])
@require_any_role(['reporter', 'volunteer', 'ngo', 'admin'])
def get_help_request(req_id):
    uid  = int(get_jwt_identity())
    user = db.get_or_404(User, uid)
    req  = db.get_or_404(HelpRequest, req_id)

    # Reporters may only view their own requests — volunteers/ngo/admin need
    # broad read access to evaluate requests (e.g. before accepting a task),
    # so only the reporter role is ownership-scoped here.
    if user.role == 'reporter' and req.user_id != uid:
        return _error('You do not have permission to view this request', 403)

    return _success({'request': req.to_dict()})


# ── PUT /help-request/status ───────────────────────────────────────────────────
@help_bp.route('/help-request/status', methods=['PUT'])
@require_any_role(['volunteer', 'ngo', 'admin'])  # Reporters cannot change status
def update_request_status():
    uid  = int(get_jwt_identity())
    user = db.get_or_404(User, uid)
    data   = request.get_json(silent=True) or {}
    req_id = data.get('request_id')
    status = data.get('status', '').strip()

    valid_statuses = ('Pending', 'Accepted', 'En Route', 'On Site', 'Completed', 'Duplicate')
    if status not in valid_statuses:
        return _error(f'status must be one of {valid_statuses}')

    req = db.get_or_404(HelpRequest, req_id)

    # Volunteers may only update the status of a request they are actually
    # assigned to (i.e. they hold an active ReliefTask against it).
    # NGO and admin retain full access, consistent with their existing
    # broad read access to all help requests.
    if user.role == 'volunteer':
        vol = Volunteer.query.filter_by(user_id=uid).first()
        is_assigned = bool(vol) and ReliefTask.query.filter_by(
            volunteer_id=vol.volunteer_id, request_id=req_id
        ).first() is not None
        if not is_assigned:
            return _error('You can only update the status of requests assigned to you', 403)

    req.status = status
    db.session.commit()
    return _success({'request': req.to_dict()}, 'Status updated')
