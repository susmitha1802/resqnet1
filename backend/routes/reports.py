"""
ResQNet — Disaster Reports Routes Blueprint
POST /report-disaster
GET  /reports
GET  /report/<id>
"""
import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import DisasterReport
from ai.severity import classify_severity
from ai.disaster_classifier import predict_disaster

reports_bp = Blueprint('reports', __name__)


def _success(data=None, message='OK', status=200):
    return jsonify({'success': True, 'message': message, **(data or {})}), status


def _error(message='Error', status=400):
    return jsonify({'success': False, 'message': message}), status


def _save_file(file_obj, subfolder: str) -> str | None:
    """Save an uploaded file and return its path, or None on failure."""
    if not file_obj or not file_obj.filename:
        return None
    ext = file_obj.filename.rsplit('.', 1)[-1].lower()
    if ext not in current_app.config['ALLOWED_EXTENSIONS']:
        return None
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(folder, exist_ok=True)
    filename = secure_filename(file_obj.filename)
    path = os.path.join(folder, filename)
    file_obj.save(path)
    return path


# ── POST /report-disaster ──────────────────────────────────────────────────────
@reports_bp.route('/report-disaster', methods=['POST'])
@jwt_required()
def report_disaster():
    uid  = int(get_jwt_identity())
    data = request.form

    disaster_type = data.get('disaster_type', '').strip()
    description   = data.get('description', '').strip()
    latitude      = data.get('latitude')
    longitude     = data.get('longitude')

    if not all([disaster_type, description, latitude, longitude]):
        return _error('disaster_type, description, latitude, and longitude are required')

    # Save image (first file if multiple)
    img_path = None
    ai_prediction = {"predicted_disaster_type": "Unknown", "confidence": 0.0, "note": None}
    if 'images' in request.files:
        img_path = _save_file(request.files['images'], 'reports')
        if not img_path:
            return _error('Uploaded image format is not supported or file is invalid', 400)
        # Pass the user-reported type through so the classifier can tell us
        # explicitly when it has no model support for that disaster type
        # (e.g. "Landslide"), instead of silently returning "Unknown".
        ai_prediction = predict_disaster(img_path, reported_disaster_type=disaster_type)

    severity = classify_severity(image_path=img_path, disaster_type=disaster_type)

    report = DisasterReport(
        user_id                 = uid,
        disaster_type           = disaster_type,
        description             = description,
        image_path              = img_path,
        predicted_disaster_type = str(ai_prediction.get('predicted_disaster_type')) if ai_prediction.get('predicted_disaster_type') is not None else None,
        prediction_confidence   = float(ai_prediction.get('confidence')) if ai_prediction.get('confidence') is not None else None,
        severity                = severity,
        latitude                = float(latitude),  # type: ignore
        longitude               = float(longitude), # type: ignore
    )
    db.session.add(report)
    db.session.commit()

    return _success(
        {
            'report':   report.to_dict(),
            'severity': severity,
            'ai_note':  ai_prediction.get('note'),
        },
        'Disaster report submitted successfully',
        201
    )


# ── GET /reports ───────────────────────────────────────────────────────────────
@reports_bp.route('/reports', methods=['GET'])
@jwt_required()
def get_reports():
    disaster_type = request.args.get('type')
    query = DisasterReport.query.order_by(DisasterReport.created_at.desc())
    if disaster_type:
        query = query.filter_by(disaster_type=disaster_type)
    reports = query.limit(100).all()
    return _success({'reports': [r.to_dict() for r in reports], 'total': len(reports)})


# ── GET /report/<id> ───────────────────────────────────────────────────────────
@reports_bp.route('/report/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    report = db.get_or_404(DisasterReport, report_id)
    return _success({'report': report.to_dict()})
