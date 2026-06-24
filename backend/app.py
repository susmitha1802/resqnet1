"""
ResQNet — Flask Application Entry Point

Architecture:
    routes/auth.py          → auth_bp          (/register, /login, /profile)
    routes/reports.py       → reports_bp       (/report-disaster, /reports, /report/<id>)
    routes/help_requests.py → help_bp          (/help-request, /help-requests, ...)
    routes/volunteers.py    → volunteers_bp    (/volunteer/*)
    routes/admin.py         → admin_bp         (/admin/*)
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import jwt_required
from flasgger import Swagger  # type: ignore[import-untyped]

from config import Config
from extensions import db, jwt
from routes import auth_bp, reports_bp, help_bp, volunteers_bp, admin_bp, ngo_bp, contact_bp, alerts_bp, preparedness_bp, map_risk_bp


# ── Swagger / OpenAPI config ───────────────────────────────────────────────────
SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route":    "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs",
}

SWAGGER_TEMPLATE = {
    "swagger": "2.0",
    "info": {
        "title":       "ResQNet API",
        "description": (
            "## ResQNet — Disaster Relief Coordination Platform\n\n"
            "Full REST API for managing disaster reports, help requests, volunteers, and admin operations.\n\n"
            "**Authentication:** Most endpoints require a JWT token. "
            "Call `POST /login` first, then pass the token as:\n"
            "`Authorization: Bearer <token>`"
        ),
        "version": "1.0.0",
        "contact": {"name": "ResQNet Team"},
    },
    "basePath": "/",
    "schemes":  ["http", "https"],
    "consumes": ["application/json"],
    "produces": ["application/json"],
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in":   "header",
            "description": "Enter: **Bearer &lt;token&gt;**",
        }
    },
    "tags": [
        {"name": "Auth",          "description": "Registration, login, and profile"},
        {"name": "Reports",       "description": "Disaster report submission and retrieval"},
        {"name": "Help Requests", "description": "SOS help request lifecycle"},
        {"name": "Volunteers",    "description": "Volunteer task management"},
        {"name": "Admin",         "description": "Admin dashboard and analytics"},
        {"name": "Map",           "description": "Live map data aggregation"},
    ],
    "paths": {
        # ── Health ────────────────────────────────────────────────────────────
        "/health": {
            "get": {
                "tags":    ["Map"],
                "summary": "Health check",
                "responses": {"200": {"description": "Server is up"}},
            }
        },
        # ── Auth ──────────────────────────────────────────────────────────────
        "/register": {
            "post": {
                "tags":    ["Auth"],
                "summary": "Register a new user",
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "required": ["name", "email", "phone", "password"],
                        "properties": {
                            "name":         {"type": "string",  "example": "Priya Sharma"},
                            "email":        {"type": "string",  "example": "priya@example.com"},
                            "phone":        {"type": "string",  "example": "9876543210"},
                            "password":     {"type": "string",  "example": "secure123"},
                            "role":         {"type": "string",  "enum": ["reporter","volunteer","ngo","admin"], "example": "reporter"},
                            "admin_secret_code": {"type": "string", "example": "RESQNET_ADMIN_2024", "description": "Required only when role=admin"},
                            "org_name":     {"type": "string",  "example": "Relief India Foundation", "description": "Required when role=ngo"},
                            "org_type":     {"type": "string",  "example": "Disaster Relief NGO"},
                            "area":         {"type": "string",  "example": "Hyderabad"},
                            "skills":       {"type": "array",   "items": {"type": "string"}, "example": ["First Aid","Driving"]},
                            "location":     {"type": "string",  "example": "Chennai"},
                            "availability": {"type": "string",  "enum": ["available","unavailable"], "example": "available"},
                        }
                    }
                }],
                "responses": {
                    "201": {"description": "User registered — returns JWT token + user object"},
                    "400": {"description": "Validation error"},
                    "409": {"description": "Email already registered"},
                },
            }
        },
        "/login": {
            "post": {
                "tags":    ["Auth"],
                "summary": "Login and receive JWT token",
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "required": ["email", "password"],
                        "properties": {
                            "email":    {"type": "string", "example": "priya@example.com"},
                            "password": {"type": "string", "example": "secure123"},
                        }
                    }
                }],
                "responses": {
                    "200": {"description": "JWT token + user object"},
                    "401": {"description": "Invalid credentials"},
                },
            }
        },
        "/profile": {
            "get": {
                "tags":     ["Auth"],
                "summary":  "Get logged-in user's profile",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {"description": "User profile object"},
                    "401": {"description": "Missing or invalid token"},
                },
            }
        },
        # ── Reports ───────────────────────────────────────────────────────────
        "/report-disaster": {
            "post": {
                "tags":        ["Reports"],
                "summary":     "Submit a new disaster report",
                "security":    [{"BearerAuth": []}],
                "consumes":    ["multipart/form-data"],
                "parameters":  [
                    {"in": "formData", "name": "disaster_type", "required": True,  "type": "string", "enum": ["Flood","Cyclone","Earthquake","Landslide","Fire"]},
                    {"in": "formData", "name": "description",   "required": True,  "type": "string"},
                    {"in": "formData", "name": "latitude",      "required": True,  "type": "number"},
                    {"in": "formData", "name": "longitude",     "required": True,  "type": "number"},
                    {"in": "formData", "name": "images",        "required": False, "type": "file"},
                ],
                "responses": {
                    "201": {"description": "Report created + AI severity assessment"},
                    "400": {"description": "Validation error"},
                },
            }
        },
        "/reports": {
            "get": {
                "tags":     ["Reports"],
                "summary":  "List recent disaster reports",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {"in": "query", "name": "type", "type": "string", "enum": ["Flood","Cyclone","Earthquake","Landslide","Fire"], "required": False},
                ],
                "responses": {
                    "200": {"description": "Array of disaster reports"},
                    "401": {"description": "Missing or invalid token"},
                },
            }
        },
        "/report/{report_id}": {
            "get": {
                "tags":     ["Reports"],
                "summary":  "Get a single disaster report by ID",
                "security": [{"BearerAuth": []}],
                "parameters": [{"in": "path", "name": "report_id", "required": True, "type": "integer"}],
                "responses": {
                    "200": {"description": "Report object"},
                    "401": {"description": "Missing or invalid token"},
                    "404": {"description": "Not found"},
                },
            }
        },
        # ── Help Requests ─────────────────────────────────────────────────────
        "/help-request": {
            "post": {
                "tags":     ["Help Requests"],
                "summary":  "Submit an SOS help request",
                "security": [{"BearerAuth": []}],
                "consumes": ["multipart/form-data"],
                "parameters": [
                    {"in": "formData", "name": "name",             "required": True,  "type": "string"},
                    {"in": "formData", "name": "contact",          "required": True,  "type": "string"},
                    {"in": "formData", "name": "request_type",     "required": True,  "type": "string", "enum": ["Food","Water","Medicine","Rescue","Shelter"]},
                    {"in": "formData", "name": "number_of_people", "required": False, "type": "integer"},
                    {"in": "formData", "name": "description",      "required": False, "type": "string"},
                    {"in": "formData", "name": "latitude",         "required": True,  "type": "number"},
                    {"in": "formData", "name": "longitude",        "required": True,  "type": "number"},
                    {"in": "formData", "name": "image",            "required": False, "type": "file"},
                ],
                "responses": {
                    "201": {"description": "Request created + AI priority/duplicate/forecast data"},
                    "400": {"description": "Validation error"},
                },
            }
        },
        "/help-requests": {
            "get": {
                "tags":     ["Help Requests"],
                "summary":  "List help requests (role-filtered)",
                "security": [{"BearerAuth": []}],
                "responses": {"200": {"description": "Array of help requests"}},
            }
        },
        "/help-request/{req_id}": {
            "get": {
                "tags":     ["Help Requests"],
                "summary":  "Get a single help request by ID",
                "security": [{"BearerAuth": []}],
                "parameters": [{"in": "path", "name": "req_id", "required": True, "type": "integer"}],
                "responses": {
                    "200": {"description": "Help request object"},
                    "404": {"description": "Not found"},
                },
            }
        },
        "/help-request/status": {
            "put": {
                "tags":     ["Help Requests"],
                "summary":  "Update help request status",
                "security": [{"BearerAuth": []}],
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "request_id": {"type": "integer"},
                            "status":     {"type": "string", "enum": ["Pending","Accepted","En Route","On Site","Completed","Duplicate"]},
                        }
                    }
                }],
                "responses": {"200": {"description": "Updated request object"}},
            }
        },
        # ── Volunteers ────────────────────────────────────────────────────────
        "/volunteer/tasks": {
            "get": {
                "tags":     ["Volunteers"],
                "summary":  "Get tasks assigned to the logged-in volunteer",
                "security": [{"BearerAuth": []}],
                "responses": {"200": {"description": "Array of relief tasks"}},
            }
        },
        "/volunteer/accept-task": {
            "put": {
                "tags":     ["Volunteers"],
                "summary":  "Accept a pending help request",
                "security": [{"BearerAuth": []}],
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "properties": {"request_id": {"type": "integer"}}
                    }
                }],
                "responses": {
                    "200": {"description": "Task created and request marked Accepted"},
                    "409": {"description": "Already on a task, or request not pending"},
                },
            }
        },
        "/volunteer/update-status": {
            "put": {
                "tags":     ["Volunteers"],
                "summary":  "Update volunteer availability",
                "security": [{"BearerAuth": []}],
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "properties": {"status": {"type": "string", "enum": ["available","unavailable","on_task"]}}
                    }
                }],
                "responses": {"200": {"description": "Updated volunteer object"}},
            }
        },
        "/volunteer/complete-task": {
            "put": {
                "tags":     ["Volunteers"],
                "summary":  "Mark an active task as completed",
                "security": [{"BearerAuth": []}],
                "parameters": [{
                    "in": "body", "name": "body", "required": True,
                    "schema": {
                        "type": "object",
                        "properties": {"task_id": {"type": "integer"}}
                    }
                }],
                "responses": {"200": {"description": "Task marked completed"}},
            }
        },
        # ── Admin ─────────────────────────────────────────────────────────────
        "/admin/dashboard": {
            "get": {
                "tags":     ["Admin"],
                "summary":  "Admin dashboard stats",
                "security": [{"BearerAuth": []}],
                "responses": {"200": {"description": "Stats + recent high-priority requests"}},
            }
        },
        "/admin/analytics": {
            "get": {
                "tags":     ["Admin"],
                "summary":  "Analytics breakdown (by type, status, priority, day)",
                "security": [{"BearerAuth": []}],
                "responses": {"200": {"description": "Analytics data"}},
            }
        },
        "/admin/reports": {
            "get": {
                "tags":     ["Admin"],
                "summary":  "Paginated disaster reports (admin)",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {"in": "query", "name": "type",   "type": "string",  "required": False},
                    {"in": "query", "name": "limit",  "type": "integer", "required": False},
                    {"in": "query", "name": "offset", "type": "integer", "required": False},
                ],
                "responses": {"200": {"description": "Paginated reports"}},
            }
        },
        "/admin/requests": {
            "get": {
                "tags":     ["Admin"],
                "summary":  "Paginated help requests (admin)",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {"in": "query", "name": "priority", "type": "string",  "required": False},
                    {"in": "query", "name": "status",   "type": "string",  "required": False},
                    {"in": "query", "name": "limit",    "type": "integer", "required": False},
                    {"in": "query", "name": "offset",   "type": "integer", "required": False},
                ],
                "responses": {"200": {"description": "Paginated help requests"}},
            }
        },
        "/admin/volunteers": {
            "get": {
                "tags":     ["Admin"],
                "summary":  "List all volunteers (admin)",
                "security": [{"BearerAuth": []}],
                "responses": {"200": {"description": "Array of volunteers"}},
            }
        },
        # ── Map ───────────────────────────────────────────────────────────────
        "/map/data": {
            "get": {
                "tags":    ["Map"],
                "summary": "Aggregated live map data (requests + reports + volunteers)",
                "responses": {"200": {"description": "Map data payload"}},
            }
        },
    },
}


# ── App Factory ────────────────────────────────────────────────────────────────
def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # ── Extensions ────────────────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    CORS(app,
         origins=app.config.get('CORS_ORIGINS', ['*']),
         supports_credentials=True)

    # ── Swagger UI ────────────────────────────────────────────────────────────
    Swagger(app, config=SWAGGER_CONFIG, template=SWAGGER_TEMPLATE)

    # ── Register Blueprints ───────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(help_bp)
    app.register_blueprint(volunteers_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ngo_bp)
    app.register_blueprint(contact_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(preparedness_bp)
    app.register_blueprint(map_risk_bp)

    # ── Create Tables ─────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()

    # ── Global Routes ─────────────────────────────────────────────────────────

    @app.route('/health', methods=['GET'])
    def health():
        """Health-check endpoint."""
        return jsonify({
            'status':  'ok',
            'app':     'ResQNet',
            'version': '1.0.0',
        })

    @app.route('/map/data', methods=['GET'])
    def map_data():
        """Aggregated data for the live map page."""
        from models import HelpRequest, DisasterReport, Volunteer, ReliefTask
        from sqlalchemy.orm import joinedload

        # Eager load user to prevent N+1 queries in Volunteer.to_dict()
        map_volunteers = Volunteer.query.options(
            joinedload(Volunteer.user)
        ).filter(
            Volunteer.last_location_lat.isnot(None),
            Volunteer.last_location_lng.isnot(None)
        ).all()

        total_volunteers = Volunteer.query.count()

        # Get requests without eager loading tasks because lazy='dynamic' doesn't support it
        requests = HelpRequest.query.filter(
            HelpRequest.status.in_(['Pending', 'Accepted'])
        ).all()

        # Build request dicts manually to avoid hitting `tasks.all()` in `to_dict()`
        requests_data = [{
            'request_id': r.request_id,
            'name': r.name,
            'contact': r.contact,
            'request_type': r.request_type,
            'priority_level': r.priority_level,
            'number_of_people': r.number_of_people,
            'description': r.description,
            'latitude': float(r.latitude),
            'longitude': float(r.longitude),
            'status': r.status,
            'created_at': r.created_at.isoformat() + 'Z' if r.created_at else None,
            # Skip assigned_volunteer to prevent N+1 queries for the map
        } for r in requests]

        reports = DisasterReport.query.order_by(
            DisasterReport.created_at.desc()
        ).limit(50).all()

        # Total active incidents = active requests + recent disaster reports
        total_active = len(requests) + len(reports)

        return jsonify({
            'success':          True,
            'requests':         requests_data,
            'reports':          [r.to_dict() for r in reports],
            'volunteers':       [v.to_dict() for v in map_volunteers],
            'total_volunteers': total_volunteers,
            'total_active':     total_active,
        })

    @app.route('/public/stats', methods=['GET'])
    def public_stats():
        """Public homepage statistics."""
        from models import HelpRequest, Volunteer, ReliefTask
        
        # Requests Handled = total requests in system
        total_requests = HelpRequest.query.count()
        
        # Active Volunteers = currently available
        active_vols = Volunteer.query.filter_by(availability_status='available').count()
        
        # Completed = total resolved requests
        completed_reqs = HelpRequest.query.filter_by(status='Completed').count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_requests': total_requests,
                'active_volunteers': active_vols,
                'completed': completed_reqs
            }
        })

    @app.route('/uploads/task_proofs/<filename>', methods=['GET'])
    @jwt_required()
    def serve_proof(filename):
        from models import ReliefTask, User, Volunteer
        import os
        from flask import send_from_directory
        
        uid = int(get_jwt_identity())
        user = User.query.get(uid)
        if not user:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
            
        if user.role == 'admin':
            return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'task_proofs'), filename)
            
        if user.role == 'volunteer':
            vol = Volunteer.query.filter_by(user_id=uid).first()
            if vol:
                img_path = f"/uploads/task_proofs/{filename}"
                task = ReliefTask.query.filter_by(proof_image_path=img_path, volunteer_id=vol.volunteer_id).first()
                if task:
                    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'task_proofs'), filename)
                    
        return jsonify({'success': False, 'message': 'Access denied'}), 403

    # ── JWT Error Handlers ────────────────────────────────────────────────────

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({'success': False, 'message': f'Missing token: {reason}'}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({'success': False, 'message': f'Invalid token: {reason}'}), 422

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({'success': False, 'message': 'Token has expired'}), 401

    # ── Generic Error Handlers ────────────────────────────────────────────────

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'success': False, 'message': 'Method not allowed'}), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

    return app


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    application = create_app()
    application.run(host='0.0.0.0', port=5000, debug=True)
