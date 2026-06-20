const https = require('https');

const req = https.request('https://student-management-w36c-9xyp3tnrd-tutrains-projects.vercel.app/api/admin/dashboard-stats', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', data.substring(0, 500));
  });
});

req.write(JSON.stringify({ period: '2026-06' }));
req.end();
