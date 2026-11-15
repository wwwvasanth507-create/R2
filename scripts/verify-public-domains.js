const https = require('https');

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, length: data.length });
      });
    }).on('error', (err) => {
      reject({ url, error: err.message });
    });
  });
}

async function main() {
  console.log('Testing Public Domains via Cloudflare Tunnel:');
  const urls = [
    'https://api.wavemusic.dpdns.org/health',
    'https://app.wavemusic.dpdns.org',
    'https://admin.wavemusic.dpdns.org'
  ];

  for (const u of urls) {
    try {
      const res = await checkUrl(u);
      console.log(`[OK] ${res.url} -> HTTP ${res.status} (Length: ${res.length} bytes)`);
    } catch (e) {
      console.error(`[FAIL] ${e.url} -> Error: ${e.error}`);
    }
  }
}

main();
