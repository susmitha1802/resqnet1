"""
ResQNet — Volunteer Routes Blueprint
GET /volunteer/tasks           — get assigned tasks (volunteer only)
PUT /volunteer/accept-task     — accept a pending request (volunteer only)
PUT /volunteer/update-status   — update availability (volunteer only)
PUT /volunteer/complete-task   — complete an active task (volunteer only)
"""
from datetime import datetime, timezone
import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import HelpRequest, Volunteer, ReliefTask
from routes.middleware import require_role

volunteers_bp = Blueprint('volunteers', __name__)


def _success(data=None, message='OK', status=200):
    return jsonify({'success': True, 'message': message, **(data or {})}), status


def _error(message='Error', status=400):
    return jsonify({'success': False, 'message': message}), status

def _save_file(file_obj, subfolder: str) -> str | None:
    """Save an uploaded file and return its path, or None on failure."""
    if not file_obj or not file_obj.filename:
        return None
    filename = secure_filename(file_obj.filename)
    folder   = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(folder, exist_ok=True)
    path     = os.path.join(folder, filename)
    file_obj.save(path)
    return f"/{current_app.config['UPLOAD_FOLDER']}/{subfolder}/{filename}".replace('\\', '/')


def _get_volunteer(uid: int) -> Volunteer | None:
    """Helper — return volunteer record for the current user or None."""
    return Volunteer.query.filter_by(user_id=uid).first()


# ── GET /volunteer/tasks ───────────────────────────────────────────────────────
@volunteers_bp.route('/volunteer/tasks', methods=['GET'])
@require_role('volunteer')
def get_volunteer_tasks():
    uid = int(get_jwt_identity())
    vol = _get_volunteer(uid)
    if not vol:
        return _error('You are not registered as a volunteer', 403)

    tasks = (
        ReliefTask.query
        .filter_by(volunteer_id=vol.volunteer_id)
        .order_by(ReliefTask.assigned_at.desc())
        .all()
    )
    return _success({'tasks': [t.to_dict() for t in tasks], 'total': len(tasks)})


# ── PUT /volunteer/accept-task ─────────────────────────────────────────────────
@volunteers_bp.route('/volunteer/accept-task', methods=['PUT'])
@require_role('volunteer')
def accept_task():
    uid  = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    req_id = data.get('request_id')

    if not req_id:
        return _error('request_id is required')

    vol = _get_volunteer(uid)
    if not vol:
        return _error('You are not registered as a volunteer', 403)

    req = db.get_or_404(HelpRequest, req_id)
    if req.status != 'Pending':
        return _error(f'Request is no longer available (current status: {req.status})', 409)

    if vol.availability_status == 'on_task':
        return _error('You already have an active task. Complete it before accepting a new one.', 409)

    task = ReliefTask(volunteer_id=vol.volunteer_id, request_id=req_id, status='Assigned')

    req.status              = 'Accepted'
    vol.assigned_tasks      += 1
    vol.availability_status = 'on_task'

    db.session.add(task)
    db.session.commit()

    return _success({'task': task.to_dict(), 'request': req.to_dict()}, 'Task accepted successfully')


# ── PUT /volunteer/update-status ───────────────────────────────────────────────
@volunteers_bp.route('/volunteer/update-status', methods=['PUT'])
@require_role('volunteer')
def update_volunteer_status():
    uid  = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    status = data.get('status', '').strip()

    valid = ('available', 'unavailable', 'on_task')
    if status not in valid:
        return _error(f'status must be one of {valid}')

    vol = _get_volunteer(uid)
    if not vol:
        return _error('You are not registered as a volunteer', 403)

    vol.availability_status = status
    db.session.commit()
    return _success({'volunteer': vol.to_dict()}, 'Availability updated')


# ── PUT /volunteer/update-location ─────────────────────────────────────────────
@volunteers_bp.route('/volunteer/update-location', methods=['PUT'])
@require_role('volunteer')
def update_volunteer_location():
    uid  = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    lat  = data.get('latitude')
    lng  = data.get('longitude')

    if lat is None or lng is None:
        return _error('latitude and longitude are required')

    vol = _get_volunteer(uid)
    if not vol:
        return _error('You are not registered as a volunteer', 403)

    vol.last_location_lat = lat
    vol.last_location_lng = lng
    db.session.commit()
    return _success({'volunteer': vol.to_dict()}, 'Location updated')


# ── POST /volunteer/upload-proof/<task_id> ──────────────────────────────────
@volunteers_bp.route('/volunteer/upload-proof/<int:task_id>', methods=['POST'])
@require_role('volunteer')
def upload_proof(task_id):
    uid  = int(get_jwt_identity())
    data = request.form
    notes = data.get('notes', '')

    vol = _get_volunteer(uid)
    if not vol:
        return _error('You are not registered as a volunteer', 403)

    task = ReliefTask.query.filter_by(
        task_id=task_id, volunteer_id=vol.volunteer_id
    ).first_or_404()

    if task.status != 'Assigned' and task.status != 'En Route' and task.status != 'On Site':
        return _error(f'Task cannot be completed from state: {task.status}')

    # Handle image
    img_path = None
    if 'proof_image' in request.files:
        img_path = _save_file(request.files['proof_image'], 'task_proofs')

    if not img_path:
        return _error('Proof image is required')

    # Update timestamps and statuses
    task.proof_image_path    = img_path
    task.completion_notes    = notes
    task.status              = 'Proof Submitted'
    task.verification_status = 'Pending'
    task.proof_submitted_at  = datetime.now(timezone.utc)
    task.request.status      = 'Proof Submitted'

    db.session.commit()
    return _success({
        'task': task.to_dict()
    }, 'Proof uploaded successfully. Pending Admin verification.')
