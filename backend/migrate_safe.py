import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get('DATABASE_URL', 'sqlite:///resqnet.db')
engine = create_engine(db_url)

with engine.connect() as conn:
    conn.execution_options(isolation_level="AUTOCOMMIT")
    print("Checking relief_tasks columns...")
    
    # Check if proof_image_path exists
    try:
        conn.execute(text("SELECT proof_image_path FROM relief_tasks LIMIT 1;"))
        print("proof_image_path exists")
    except Exception as e:
        print("proof_image_path does not exist, adding...")
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN proof_image_path VARCHAR(255);"))
        except Exception as e2:
            print("Failed to add proof_image_path:", e2)

    # Check if completion_notes exists
    try:
        conn.execute(text("SELECT completion_notes FROM relief_tasks LIMIT 1;"))
        print("completion_notes exists")
    except Exception as e:
        print("completion_notes does not exist, adding...")
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN completion_notes TEXT;"))
        except Exception as e2:
            print("Failed to add completion_notes:", e2)
            
    # Check if verification_status exists
    try:
        conn.execute(text("SELECT verification_status FROM relief_tasks LIMIT 1;"))
        print("verification_status exists")
    except Exception as e:
        print("verification_status does not exist, adding...")
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN verification_status task_verification_status DEFAULT 'Pending';"))
        except Exception as e2:
            print("Failed to add verification_status:", e2)
            
    # Check if verified_by_admin_id exists
    try:
        conn.execute(text("SELECT verified_by_admin_id FROM relief_tasks LIMIT 1;"))
        print("verified_by_admin_id exists")
    except Exception as e:
        print("verified_by_admin_id does not exist, adding...")
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN verified_by_admin_id INTEGER REFERENCES users(user_id);"))
        except Exception as e2:
            print("Failed to add verified_by_admin_id:", e2)
