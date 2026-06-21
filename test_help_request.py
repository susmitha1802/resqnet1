import requests
import json

url = 'http://127.0.0.1:5000/help-request'
data = {
    'name': 'Test Victim',
    'contact': '9999999999',
    'request_type': 'Medicine',
    'number_of_people': 3,
    'latitude': 17.0,
    'longitude': 83.0
}
try:
    response = requests.post(url, json=data)
    print(response.status_code)
    print(response.text)
except Exception as e:
    print('Exception:', e)
