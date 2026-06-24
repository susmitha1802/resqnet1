from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import User, PreparednessPing, WeatherAlert
from routes.middleware import require_any_role

preparedness_bp = Blueprint('preparedness', __name__)

@preparedness_bp.route('/preparedness/my-pings', methods=['GET'])
@jwt_required()
@require_any_role(['volunteer', 'ngo'])
def get_my_pings():
    uid = get_jwt_identity()
    pings = PreparednessPing.query.filter_by(user_id=uid).order_by(PreparednessPing.sent_at.desc()).all()
    
    result = []
    pending_count = 0
    for ping in pings:
        if ping.status == 'Sent':
            pending_count += 1
        
        alert = ping.alert
        ping_dict = ping.to_dict()
        if alert:
            ping_dict.update({
                'alert_type': alert.alert_type,
                'severity': alert.severity,
                'description': alert.description,
                'expires_at': alert.expires_at.isoformat() + 'Z' if alert.expires_at else None,
                'affected_lat': float(alert.affected_lat),
                'affected_lng': float(alert.affected_lng)
            })
        result.append(ping_dict)
        
    return jsonify({
        'success': True,
        'pings': result,
        'pending_count': pending_count
    }), 200

@preparedness_bp.route('/preparedness/ping/<int:ping_id>', methods=['PUT'])
@jwt_required()
@require_any_role(['volunteer', 'ngo'])
def respond_to_ping(ping_id):
    uid = get_jwt_identity()
    ping = PreparednessPing.query.get_or_404(ping_id)
    
    if str(ping.user_id) != str(uid):
        return jsonify({'success': False, 'message': 'Forbidden'}), 403
        
    if ping.status != 'Sent':
        return jsonify({'success': False, 'message': 'Ping already responded to'}), 409
        
    data = request.get_json() or {}
    new_status = data.get('status')
    
    if new_status not in ('Acknowledged', 'Unavailable'):
        return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
    ping.status = new_status
    ping.acknowledged_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Ping responded successfully'}), 200
