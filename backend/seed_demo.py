import os
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Ensure we can import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
import bcrypt
from extensions import db
from models import (
    User, Volunteer, DisasterReport, HelpRequest, ReliefTask, 
    ReliefResource, WeatherAlert, PreparednessPing, ContactMessage
)

def seed():
    app = create_app()
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Creating all tables...")
        db.create_all()

        pwd = bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # 1. USERS
        print("Seeding Users...")
        admin = User(name='Admin', email='admin@resqnet.com', phone='+1234567890', password=pwd, role='admin')
        ngo1 = User(name='Red Cross', email='redcross@resqnet.com', phone='+1987654321', password=pwd, role='ngo', location='17.4501, 78.4387')
        ngo2 = User(name='Global Relief', email='globalrelief@resqnet.com', phone='+1122334455', password=pwd, role='ngo', location='17.4301, 78.4587')
        
        vol1_user = User(name='John Doe', email='vol1@resqnet.com', phone='+1112223333', password=pwd, role='volunteer', skills='Medical, Rescue', location='17.4421, 78.4497')
        vol2_user = User(name='Jane Smith', email='vol2@resqnet.com', phone='+4445556666', password=pwd, role='volunteer', skills='Transport, Food', location='17.4391, 78.4477')
        vol3_user = User(name='Alex Wong', email='vol3@resqnet.com', phone='+7778889999', password=pwd, role='volunteer', skills='Search and Rescue', location='17.4451, 78.4527', availability='unavailable')

        rep1 = User(name='Alice Brown', email='reporter1@resqnet.com', phone='+1231231234', password=pwd, role='reporter')
        rep2 = User(name='Bob White', email='reporter2@resqnet.com', phone='+3213214321', password=pwd, role='reporter')

        db.session.add_all([admin, ngo1, ngo2, vol1_user, vol2_user, vol3_user, rep1, rep2])
        db.session.commit()

        # 2. VOLUNTEER PROFILES
        print("Seeding Volunteer Profiles...")
        vol1 = Volunteer(user_id=vol1_user.user_id, availability_status='available')
        vol1.rating = Decimal('4.9'); vol1.last_location_lat = Decimal('17.4421'); vol1.last_location_lng = Decimal('78.4497')
        vol2 = Volunteer(user_id=vol2_user.user_id, availability_status='on_task', assigned_tasks=1)
        vol2.rating = Decimal('4.7'); vol2.last_location_lat = Decimal('17.4391'); vol2.last_location_lng = Decimal('78.4477')
        vol3 = Volunteer(user_id=vol3_user.user_id, availability_status='unavailable', completed_tasks=5)
        vol3.rating = Decimal('5.0')
        
        db.session.add_all([vol1, vol2, vol3])
        db.session.commit()

        # 3. WEATHER ALERTS & PREPAREDNESS PINGS
        print("Seeding Weather Alerts and Pings...")
        now = datetime.now(timezone.utc)
        alert = WeatherAlert(
            source='OpenWeatherMap',
            alert_type='Flood',
            severity='Emergency',
            description='Severe flash flooding expected in the Hyderabad region over the next 48 hours.',
            affected_lat=17.4401,
            affected_lng=78.4487,
            affected_radius_km=50,
            expires_at=now + timedelta(hours=46)
        )
        alert.issued_at = now - timedelta(hours=2)
        alert.notified_at = now - timedelta(hours=1)
        db.session.add(alert)
        db.session.commit()

        ping1 = PreparednessPing(alert_id=alert.alert_id, user_id=ngo1.user_id)
        ping1.status = 'Acknowledged'; ping1.sent_at = now - timedelta(hours=1); ping1.acknowledged_at = now - timedelta(minutes=45)
        ping2 = PreparednessPing(alert_id=alert.alert_id, user_id=vol1_user.user_id)
        ping2.status = 'Pending'; ping2.sent_at = now - timedelta(hours=1)
        ping3 = PreparednessPing(alert_id=alert.alert_id, user_id=vol2_user.user_id)
        ping3.status = 'Acknowledged'; ping3.sent_at = now - timedelta(hours=1); ping3.acknowledged_at = now - timedelta(minutes=30)
        db.session.add_all([ping1, ping2, ping3])
        db.session.commit()

        # 4. DISASTER REPORTS
        print("Seeding Disaster Reports...")
        rep_a = DisasterReport(
            user_id=rep1.user_id, disaster_type='Flood', description='Major street flooding, water levels rising fast.',
            latitude=17.4431, longitude=78.4500, predicted_disaster_type='Flood', prediction_confidence=92.5, severity='Severe Damage'
        )
        rep_b = DisasterReport(
            user_id=rep2.user_id, disaster_type='Flood', description='River overflow near the main bridge.',
            latitude=17.4300, longitude=78.4400, predicted_disaster_type='Flood', prediction_confidence=88.2, severity='Moderate Damage'
        )
        rep_c = DisasterReport(
            user_id=vol1_user.user_id, disaster_type='Fire', description='Electrical fire due to short circuit from rain.',
            latitude=17.4500, longitude=78.4350, predicted_disaster_type='Fire', prediction_confidence=75.0, severity='Low Damage'
        )
        db.session.add_all([rep_a, rep_b, rep_c])
        db.session.commit()

        # 5. HELP REQUESTS
        print("Seeding Help Requests...")
        req1 = HelpRequest(user_id=rep1.user_id, name='Alice Brown', contact='+1231231234', request_type='Rescue', latitude=17.4435, longitude=78.4505, priority_level='High', number_of_people=3, status='Pending')
        req2 = HelpRequest(user_id=rep2.user_id, name='Bob White', contact='+3213214321', request_type='Food', latitude=17.4320, longitude=78.4420, priority_level='Medium', number_of_people=5, status='Accepted')
        req3 = HelpRequest(user_id=rep1.user_id, name='Alice Brown', contact='+1231231234', request_type='Medicine', latitude=17.4440, longitude=78.4510, priority_level='High', number_of_people=1, status='En Route')
        req4 = HelpRequest(user_id=vol3_user.user_id, name='Local Clinic', contact='+9998887777', request_type='Water', latitude=17.4480, longitude=78.4580, priority_level='Low', number_of_people=20, status='Completed')
        req5 = HelpRequest(user_id=rep2.user_id, name='Shelter Seeker', contact='+3213214321', request_type='Shelter', latitude=17.4350, longitude=78.4450, priority_level='Medium', number_of_people=2, status='Duplicate', is_duplicate=True)
        db.session.add_all([req1, req2, req3, req4, req5])
        db.session.commit()

        # 6. RELIEF TASKS
        print("Seeding Relief Tasks...")
        task1 = ReliefTask(volunteer_id=vol2.volunteer_id, request_id=req3.request_id, status='En Route', verification_status='Pending')
        task1.assigned_at = now - timedelta(minutes=20)
        
        task2 = ReliefTask(volunteer_id=vol3.volunteer_id, request_id=req4.request_id, status='Completed', verification_status='Verified', verified_by_admin_id=admin.user_id)
        task2.assigned_at = now - timedelta(days=1); task2.completed_at = now - timedelta(hours=10)
        db.session.add_all([task1, task2])
        db.session.commit()

        # 7. RELIEF RESOURCES
        print("Seeding Relief Resources...")
        res1 = ReliefResource(name='Bottled Water', category='Water', quantity=2000, unit='Liters', location='17.4501, 78.4387', added_by=ngo1.user_id)
        res2 = ReliefResource(name='Medical Kits', category='Medicine', quantity=50, unit='Boxes', location='17.4301, 78.4587', added_by=ngo2.user_id, allocated_to=req3.request_id, allocated_at=now - timedelta(minutes=30))
        res3 = ReliefResource(name='Life Jackets', category='Rescue', quantity=100, unit='Units', location='17.4501, 78.4387', added_by=ngo1.user_id)
        res4 = ReliefResource(name='Canned Beans', category='Food', quantity=500, unit='Cans', location='17.4301, 78.4587', added_by=ngo2.user_id, allocated_to=req2.request_id, allocated_at=now - timedelta(minutes=15))
        db.session.add_all([res1, res2, res3, res4])
        db.session.commit()

        print("Database seeded successfully with 'Operation Flash Flood' demo data!")

if __name__ == '__main__':
    seed()
