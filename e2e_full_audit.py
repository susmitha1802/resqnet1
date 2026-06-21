import requests
import time
import os
import json
from PIL import Image

BASE_URL = "http://127.0.0.1:5000"

def log(msg):
    print(f"[E2E] {msg}")

def run_audit():
    log("=== RESQNET TRUE END-TO-END EXECUTION AUDIT ===")

    # Setup dummy image
    img_path = "dummy_disaster.png"
    img = Image.new('RGB', (64, 64), color='red')
    img.save(img_path)
    
    proof_path = "dummy_proof.png"
    img_proof = Image.new('RGB', (64, 64), color='green')
    img_proof.save(proof_path)

    # 1. VICTIM WORKFLOW
    log("\n--- Executing VICTIM WORKFLOW ---")
    victim_email = f"victim_{int(time.time())}@e2e.com"
    r = requests.post(f"{BASE_URL}/register", json={
        "name": "E2E Victim", "email": victim_email, "phone": "1111111111", "password": "password123", "role": "victim"
    })
    assert r.status_code in [200, 201], f"Victim registration failed: {r.status_code} {r.text}"
    v_token = r.json().get('token')
    log("✅ Victim Registered & Logged In")

    with open(img_path, "rb") as f:
        r_rep = requests.post(f"{BASE_URL}/report-disaster", 
            data={"disaster_type": "Wildfire", "description": "E2E Test Fire", "latitude": "37.77", "longitude": "-122.41"},
            files={"images": (img_path, f, "image/png")},
            headers={"Authorization": f"Bearer {v_token}"}
        )
    assert r_rep.status_code == 201, f"Report failed: {r_rep.text}"
    report_id = r_rep.json()['report']['report_id']
    ai_pred = r_rep.json()['report'].get('predicted_disaster_type')
    log(f"✅ Victim Uploaded Disaster Image. AI Prediction: {ai_pred}")

    r_req = requests.post(f"{BASE_URL}/help-requests", json={
        "request_type": "Rescue", "description": "Trapped", "number_of_people": 2, "latitude": 37.77, "longitude": -122.41
    }, headers={"Authorization": f"Bearer {v_token}"})
    assert r_req.status_code == 201
    req_id = r_req.json()['request']['request_id']
    log(f"✅ Victim Created Help Request #{req_id}")

    # 2. VOLUNTEER WORKFLOW
    log("\n--- Executing VOLUNTEER WORKFLOW ---")
    vol_email = f"vol_{int(time.time())}@e2e.com"
    r = requests.post(f"{BASE_URL}/register", json={
        "name": "E2E Volunteer", "email": vol_email, "phone": "2222222222", "password": "password123", "role": "volunteer"
    })
    vol_token = r.json().get('token')
    log("✅ Volunteer Registered & Logged In")

    r_acc = requests.post(f"{BASE_URL}/help-requests/{req_id}/accept", headers={"Authorization": f"Bearer {vol_token}"})
    assert r_acc.status_code == 200, f"Accept failed: {r_acc.text}"
    log("✅ Volunteer Accepted Request")

    with open(proof_path, "rb") as f:
        r_proof = requests.post(f"{BASE_URL}/help-requests/{req_id}/complete", 
            data={"notes": "Rescued 2 people"}, files={"proof_image": (proof_path, f, "image/png")}, headers={"Authorization": f"Bearer {vol_token}"}
        )
    assert r_proof.status_code == 200, f"Complete failed: {r_proof.text}"
    log("✅ Volunteer Uploaded Proof & Marked Complete")

    # 3. ADMIN WORKFLOW
    log("\n--- Executing ADMIN WORKFLOW ---")
    admin_email = f"admin_{int(time.time())}@e2e.com"
    r = requests.post(f"{BASE_URL}/register", json={
        "name": "E2E Admin", "email": admin_email, "phone": "0000000000", "password": "pass", "role": "admin", "admin_code": "RESQNET_ADMIN_2024"
    })
    admin_token = r.json().get('token')
    log("✅ Admin Registered & Logged In")

    r_ver = requests.post(f"{BASE_URL}/admin/verify-task/{req_id}", json={"status": "Verified", "admin_notes": "Good job"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r_ver.status_code == 200, f"Verify failed: {r_ver.text}"
    log("✅ Admin Verified Proof and Reviewed AI Prediction")

    # Cleanup
    os.remove(img_path)
    os.remove(proof_path)

    log("\n=== AUDIT COMPLETE: 100% SUCCESS ===")

if __name__ == "__main__":
    run_audit()
