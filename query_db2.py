import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT report_id, disaster_type, image_path, predicted_disaster_type, created_at FROM disaster_reports ORDER BY report_id ASC;"))
    rows = result.fetchall()
    for row in rows:
        print(f"[{row[0]}] {row[1]} | IMG: {row[2]} | PRED: {row[3]} | TIME: {row[4]}")
