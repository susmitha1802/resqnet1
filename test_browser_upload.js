const fs = require('fs');

async function run() {
  const fetch = (await import('node-fetch')).default;
  const { FormData, File } = await import('formdata-node');
  const { fileFromPath } = await import('formdata-node/file-from-path');

  // Register
  let res = await fetch('http://127.0.0.1:5000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "NodeJS", email: "node" + Date.now() + "@test.com", phone: "123", password: "password123", role: "victim"
    })
  });
  let data = await res.json();
  let token = data.token;

  // Upload
  const formData = new FormData();
  formData.append('disaster_type', 'Fire');
  formData.append('description', 'Test JS');
  formData.append('latitude', '1');
  formData.append('longitude', '1');
  
  // Dummy file
  fs.writeFileSync('dummy_js.png', 'fake image data');
  const file = await fileFromPath('dummy_js.png');
  
  // Exactly as in report.js
  formData.append('images', file);

  res = await fetch('http://127.0.0.1:5000/report-disaster', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  });
  data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
