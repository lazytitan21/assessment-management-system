const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZHN4aGdzcG1sbHdzanBvdHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ4MzU0OCwiZXhwIjoyMDg3MDU5NTQ4fQ.-YewfEclZ93v9tPAsc8RiWnXxra8hlIDz7-Nlccrrao';
const HOST = 'wxdsxhgspmllwsjpotzy.supabase.co';

function restQuery(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      path: '/rest/v1/' + path,
      method: 'GET',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get full errors for supervisors and admins
  console.log('=== supervisors ===');
  var r1 = await restQuery('supervisors?select=*&limit=1');
  console.log(r1.status, r1.body);

  console.log('\n=== admins ===');
  var r2 = await restQuery('admins?select=*&limit=1');
  console.log(r2.status, r2.body);

  console.log('\n=== assessments ===');
  var r3 = await restQuery('assessments?select=*&limit=1');
  console.log(r3.status, r3.body);

  // check examinees columns
  console.log('\n=== examinees columns ===');
  var r4 = await restQuery('examinees?select=*&limit=1');
  console.log(r4.status, r4.body);

  // check attendance_records columns
  console.log('\n=== attendance_records columns ===');
  var r5 = await restQuery('attendance_records?select=*&limit=1');
  console.log(r5.status, r5.body);
}
main().catch(console.error);
