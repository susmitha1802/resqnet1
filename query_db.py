import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT report_id, disaster_type, image_path, predicted_disaster_type FROM disaster_reports ORDER BY report_id DESC LIMIT 1;"))
    row = result.fetchone()
    if row:
        print(f"REPORT ID: {row[0]}")
        print(f"DISASTER TYPE: {row[1]}")
        print(f"IMAGE PATH: {row[2]}")
        print(f"PREDICTED DISASTER TYPE: {row[3]}")
    else:
        print("No reports found.")
