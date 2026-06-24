"""
ResQNet — NGO Routes Blueprint
GET  /ngo/dashboard   — stats for the NGO
GET  /ngo/resources   — list relief resources
POST /ngo/resources   — add a relief resource
GET  /ngo/requests    — all active help requests (NGO read-only view)
PUT  /ngo/allocate    — allocate a resource to a help request
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from extensions import db
from models import User, HelpRequest, DisasterReport, ReliefResource
from routes.middleware import require_role, require_any_role

ngo_bp = Blueprint('ngo', __name__)


def _success(data=None, message='OK', status=200):
    return jsonify({'success': True, 'message': message, **(data or {})}), status


def _error(message='Error', status=400):
    return jsonify({'success': False, 'message': message}), status


# ── GET /ngo/dashboard ─────────────────────────────────────────────────────────
@ngo_bp.route('/ngo/dashboard', methods=['GET'])
@require_role('ngo')
def ngo_dashboard():
    """
    NGO dashboard overview stats.
    ---
    tags:
      - NGO
    security:
      - BearerAuth: []
    responses:
      200:
        description: NGO dashboard statistics
      403:
        description: NGO role required
    """
    uid  = int(get_jwt_identity())
    user = db.session.get(User, uid)

    stats = {
        'total_active_requests':  HelpRequest.query.filter(
            HelpRequest.status.in_(['Pending', 'Accepted', 'En Route', 'On Site'])
        ).count(),
        'high_priority_requests': HelpRequest.query.filter_by(priority_level='High', status='Pending').count(),
        'completed_requests':     HelpRequest.query.filter_by(status='Completed').count(),
        'disaster_reports':       DisasterReport.query.count(),
        'resources_in_inventory': ReliefResource.query.count(),
        'allocated_resources':    ReliefResource.query.filter(ReliefResource.allocated_to.isnot(None)).count(),
    }

    # Recent 5 high-priority pending requests
    recent_urgent = (
        HelpRequest.query
        .filter_by(priority_level='High', status='Pending')
        .order_by(HelpRequest.created_at.desc())
        .limit(5).all()
    )

    return _success({
        'stats':        stats,
        'recent_urgent': [r.to_dict() for r in recent_urgent],
        'ngo_name':     (user.location or user.name) if user else 'Unknown NGO',
    })


# ── GET /ngo/resources ─────────────────────────────────────────────────────────
@ngo_bp.route('/ngo/resources', methods=['GET'])
@require_role('ngo')
def get_ngo_resources():
    """
    List all relief resources managed by the NGO.
    ---
    tags:
      - NGO
    security:
      - BearerAuth: []
    responses:
      200:
        description: List of resources
    """
    resources = ReliefResource.query.order_by(ReliefResource.added_at.desc()).all()
    return _success({
        'resources': [r.to_dict() for r in resources],
        'total':     len(resources),
    })


# ── POST /ngo/resources ────────────────────────────────────────────────────────
@ngo_bp.route('/ngo/resources', methods=['POST'])
@require_role('ngo')
def add_ngo_resource():
    """
    Add a new relief resource to inventory.
    ---
    tags:
      - NGO
    security:
      - BearerAuth: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:      { type: string, example: "Food Packets" }
            category:  { type: string, example: "Food" }
            quantity:  { type: integer, example: 500 }
            unit:      { type: string, example: "packets" }
            location:  { type: string, example: "Kukatpally Warehouse" }
    responses:
      201:
        description: Resource added
    """
    uid  = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    name     = data.get('name', '').strip()
    category = data.get('category', 'General').strip()
    quantity = data.get('quantity', 0)
    unit     = data.get('unit', 'units').strip()
    location = data.get('location', '').strip()

    if not name or quantity <= 0:
        return _error('name and quantity (>0) are required')

    resource = ReliefResource(
        name     = name,
        category = category,
        quantity = quantity,
        unit     = unit,
        location = location,
        added_by = uid,
    )
    db.session.add(resource)
    db.session.commit()

    return _success({'resource': resource.to_dict()}, 'Resource added to inventory', 201)


# ── GET /ngo/requests ──────────────────────────────────────────────────────────
@ngo_bp.route('/ngo/requests', methods=['GET'])
@require_role('ngo')
def ngo_get_requests():
    """
    View all active help requests (NGO read-only).
    ---
    tags:
      - NGO
    security:
      - BearerAuth: []
    responses:
      200:
        description: Active help requests
    """
    status_filter = request.args.get('status')
    type_filter   = request.args.get('type')
    priority_filter = request.args.get('priority')

    query = HelpRequest.query

    if status_filter:
        query = query.filter_by(status=status_filter)
    else:
        # Default: show active requests
        query = query.filter(
            HelpRequest.status.in_(['Pending', 'Accepted', 'En Route', 'On Site'])
        )

    if type_filter:
        query = query.filter_by(request_type=type_filter)
    if priority_filter:
        query = query.filter_by(priority_level=priority_filter)

    reqs = query.order_by(HelpRequest.created_at.desc()).all()

    return _success({
        'requests': [r.to_dict() for r in reqs],
        'total':    len(reqs),
    })


# ── PUT /ngo/allocate ──────────────────────────────────────────────────────────
@ngo_bp.route('/ngo/allocate', methods=['PUT'])
@require_role('ngo')
def ngo_allocate_resource():
    """
    Allocate a resource to a specific help request.
    ---
    tags:
      - NGO
    security:
      - BearerAuth: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            resource_id: { type: integer }
            request_id:  { type: integer }
    responses:
      200:
        description: Resource allocated
      404:
        description: Resource or request not found
    """
    data        = request.get_json(silent=True) or {}
    resource_id = data.get('resource_id')
    request_id  = data.get('request_id')

    if not resource_id or not request_id:
        return _error('resource_id and request_id are required')

    resource = db.session.get(ReliefResource, resource_id)
    if not resource:
        return _error(f'Resource {resource_id} not found', 404)

    if resource.allocated_to is not None:
        return _error(f'Resource {resource_id} is already allocated to request #{resource.allocated_to}', 409)

    req = db.session.get(HelpRequest, request_id)
    if not req:
        return _error(f'Help request {request_id} not found', 404)

    resource.allocated_to = request_id
    resource.allocated_at = datetime.now(timezone.utc)
    db.session.commit()

    return _success({
        'resource': resource.to_dict(),
        'request':  req.to_dict(),
    }, 'Resource allocated successfully')
