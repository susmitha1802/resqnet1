import requests

auth_url = 'http://127.0.0.1:5000/auth/login'
req_url = 'http://127.0.0.1:5000/help-request'

auth_data = {
    'email': 'susmitha.victim@test.com',
    'password': 'Password123'
}

r = requests.post(auth_url, json=auth_data)
token = r.json().get('token')

headers = {'Authorization': f'Bearer {token}'}

req_data = {
    'name': 'Test Victim',
    'contact': '9999999999',
    'request_type': 'Medicine',
    'number_of_people': 3,
    'latitude': 17.0,
    'longitude': 83.0
}

r2 = requests.post(req_url, data=req_data, headers=headers)
print(r2.status_code)
print(r2.text)
