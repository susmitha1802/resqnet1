import sys
sys.path.append('backend')
from app import create_app
from extensions import db
from models import HelpRequest, DisasterReport, User

app = create_app()
with app.app_context():
    by_type = db.session.query(HelpRequest.request_type, db.func.count(HelpRequest.request_id)).group_by(HelpRequest.request_type).all()
    print("by_type:", by_type)
    by_disaster = db.session.query(DisasterReport.disaster_type, db.func.count(DisasterReport.report_id)).group_by(DisasterReport.disaster_type).all()
    print("by_disaster:", by_disaster)
