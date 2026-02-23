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
  // Check assessments
  console.log('=== Assessments ===');
  var r1 = await restQuery('assessments?select=*');
  console.log(r1.body);

  // Check examinees with assessment_id
  console.log('\n=== Examinees (first 5, key columns) ===');
  var r2 = await restQuery('examinees?select=id,center_id,full_name,assessment_id,exam_session&limit=5');
  console.log(r2.body);

  // Count examinees with assessment_id set
  console.log('\n=== Examinees WITH assessment_id ===');
  var r3 = await restQuery('examinees?select=id&not.assessment_id=is.null');
  var parsed3 = JSON.parse(r3.body);
  console.log('Count:', Array.isArray(parsed3) ? parsed3.length : 'ERROR', r3.body.substring(0, 100));

  // Count examinees WITHOUT assessment_id
  console.log('\n=== Examinees WITHOUT assessment_id ===');
  var r4 = await restQuery('examinees?select=id&assessment_id=is.null');
  var parsed4 = JSON.parse(r4.body);
  console.log('Count:', Array.isArray(parsed4) ? parsed4.length : 'ERROR');

  // Check supervisor's center and what examinees are there
  console.log('\n=== Supervisor center (ajmn = 7c2ad7c7-0ea2-452e-a615-a5668520dd96) examinees ===');
  var r5 = await restQuery('examinees?select=id,full_name,assessment_id,exam_session&center_id=eq.7c2ad7c7-0ea2-452e-a615-a5668520dd96');
  console.log(r5.body);

  // List all centers with examinee counts
  console.log('\n=== Centers ===');
  var r6 = await restQuery('centers?select=id,name');
  console.log(r6.body);
}
main().catch(console.error);
