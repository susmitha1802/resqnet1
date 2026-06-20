from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    with db.engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            conn.execute(text("ALTER TYPE relief_task_status ADD VALUE 'Proof Submitted';"))
            print('Added Proof Submitted to ENUM.')
        except Exception as e:
            print('ENUM alter failed or already exists:', e)
        
        try:
            conn.execute(text("CREATE TYPE task_verification_status AS ENUM ('Pending', 'Approved', 'Rejected');"))
            print('Created task_verification_status ENUM.')
        except Exception as e:
            print('task_verification_status ENUM might already exist:', e)
        
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN proof_image_path VARCHAR(255);"))
        except Exception as e:
            print('Add proof_image_path failed:', e)
            
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN completion_notes TEXT;"))
        except Exception as e:
            print('Add completion_notes failed:', e)
            
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN verification_status task_verification_status DEFAULT 'Pending';"))
        except Exception as e:
            print('Add verification_status failed:', e)
            
        try:
            conn.execute(text("ALTER TABLE relief_tasks ADD COLUMN verified_by_admin_id INTEGER REFERENCES users(user_id);"))
            print('Added columns successfully.')
        except Exception as e:
            print('Add verified_by_admin_id failed:', e)
