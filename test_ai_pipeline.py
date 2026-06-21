import os
import requests
from io import BytesIO

# 1. Create a fake PNG image
png_data = BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
png_data.name = 'test.png'

# 2. Create a fake WEBP image
webp_data = BytesIO(b'RIFF\x14\x00\x00\x00WEBPVP8 \x04\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')
webp_data.name = 'test.webp'

print("=== TESTING VALID PNG UPLOAD ===")
res_png = requests.post(
    'http://127.0.0.1:5000/report-disaster',
    data={
        'disaster_type': 'Flood',
        'description': 'Test PNG upload',
        'latitude': 17.0,
        'longitude': 78.0
    },
    files={'images': ('test.png', png_data, 'image/png')}
)
print("PNG Response:", res_png.json())

print("\n=== TESTING INVALID WEBP UPLOAD ===")
res_webp = requests.post(
    'http://127.0.0.1:5000/report-disaster',
    data={
        'disaster_type': 'Earthquake',
        'description': 'Test WEBP upload',
        'latitude': 17.0,
        'longitude': 78.0
    },
    files={'images': ('test.webp', webp_data, 'image/webp')}
)
print("WEBP Response:", res_webp.json())
