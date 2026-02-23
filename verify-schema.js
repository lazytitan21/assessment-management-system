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
  console.log('=== 1. Assessments table ===');
  var r1 = await restQuery('assessments?select=*&limit=1');
  console.log('Status:', r1.status, r1.status === 200 ? 'EXISTS' : 'MISSING');
  console.log('Data:', r1.body.substring(0, 200));

  console.log('\n=== 2. Examinees with new columns ===');
  var r2 = await restQuery('examinees?select=id,center_id,full_name,assessment_id,session_number,room,seat_number&limit=1');
  console.log('Status:', r2.status, r2.status === 200 ? 'OK' : 'ERROR');
  console.log('Data:', r2.body.substring(0, 300));

  console.log('\n=== 3. All tables check ===');
  var tables = ['centers', 'supervisors', 'examinees', 'attendance_records', 'assessments', 'admins'];
  for (var t of tables) {
    var res = await restQuery(t + '?select=id&limit=0');
    console.log('  ' + t + ': ' + (res.status === 200 ? 'OK' : 'ERROR(' + res.status + ')'));
  }

  console.log('\nSchema verification complete!');
}
main().catch(console.error);
