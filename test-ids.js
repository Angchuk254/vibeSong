const https = require('https');

const ids = [
  'b6747d04', '5b206cd2', 'c4bcafdc', 'c21f0088', 'b8441cd5', '3b9d9972', 'f3a699c2', '821f5fb1', 'a1936e3c'
];

async function checkIds() {
  for (const id of ids) {
    const url = `https://api.jamendo.com/v3.0/tracks?client_id=${id}&format=json&limit=1`;
    await new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.headers && parsed.headers.status === 'success') {
              console.log('SUCCESS! Works:', id);
            } else {
              console.log('Failed:', id, parsed.headers.error_message);
            }
          } catch(e) {
            console.log('Failed to parse:', id);
          }
          resolve();
        });
      }).on('error', () => {
        console.log('Network error:', id);
        resolve();
      });
    });
  }
}

checkIds();
