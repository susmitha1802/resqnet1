import math
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify
from sqlalchemy import or_
from models import WeatherAlert, DisasterReport

map_risk_bp = Blueprint('map_risk', __name__)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def count_recent_reports(lat, lng, radius_km):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    reports = DisasterReport.query.filter(DisasterReport.created_at >= thirty_days_ago).all()
    count = 0
    for r in reports:
        if r.latitude is not None and r.longitude is not None:
            dist = haversine(float(lat), float(lng), float(r.latitude), float(r.longitude))
            if dist <= float(radius_km):
                count += 1
    return count

def compute_risk_score(lat, lng, radius_km, severity):
    alert_score = 0
    if severity == 'Emergency': alert_score = 3
    elif severity == 'Warning': alert_score = 2
    elif severity == 'Watch': alert_score = 1

    recent_reports = count_recent_reports(lat, lng, radius_km)
    report_score = min(recent_reports / 5, 1.0)

    total = (alert_score * 0.6) + (report_score * 0.4)
    if total >= 1.8:   return "High"
    elif total >= 0.8: return "Medium"
    else:              return "Low"

@map_risk_bp.route('/map/risk-zones', methods=['GET'])
def get_risk_zones():
    now = datetime.now(timezone.utc)
    active_alerts = WeatherAlert.query.filter(
        or_(WeatherAlert.expires_at == None, WeatherAlert.expires_at > now)
    ).all()
    
    zones = []
    for alert in active_alerts:
        risk_level = compute_risk_score(float(alert.affected_lat), float(alert.affected_lng), float(alert.affected_radius_km), alert.severity)
        zones.append({
            "alert_id": alert.alert_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "risk_level": risk_level,
            "lat": float(alert.affected_lat),
            "lng": float(alert.affected_lng),
            "radius_km": alert.affected_radius_km,
            "description": alert.description
        })
        
    return jsonify({"zones": zones})
