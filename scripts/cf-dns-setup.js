const https = require('https');

const zoneId = 'aebc2728ab2474894ad36ca22bf05ca6';
const token = 'cfut_HUFaUjO9hHIyjI50Qd676vP6NQ2U103W4htGJxVT0c03eba2';
const tunnelCname = '563d65d4-a284-49f6-bf90-f941d5ca4ce1.cfargotunnel.com';

function createDnsRecord(name) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      type: 'CNAME',
      name: name,
      content: tunnelCname,
      proxied: true,
      ttl: 1
    });

    const req = https.request({
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/zones/${zoneId}/dns_records`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Adding admin.wavemusic.dpdns.org DNS record...');
  const resAdmin = await createDnsRecord('admin.wavemusic.dpdns.org');
  console.log('Result for admin:', resAdmin.success ? 'SUCCESS' : resAdmin.errors);

  console.log('Adding app.wavemusic.dpdns.org DNS record...');
  const resApp = await createDnsRecord('app.wavemusic.dpdns.org');
  console.log('Result for app:', resApp.success ? 'SUCCESS' : resApp.errors);
}

main().catch(console.error);
