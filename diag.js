const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZHN4aGdzcG1sbHdzanBvdHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ4MzU0OCwiZXhwIjoyMDg3MDU5NTQ4fQ.-YewfEclZ93v9tPAsc8RiWnXxra8hlIDz7-Nlccrrao';
const BASE = 'wxdsxhgspmllwsjpotzy.supabase.co';

function query(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: BASE,
      path: '/rest/v1/' + path,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== CENTERS ===');
  var centers = await query('centers?select=id,name');
  console.log(JSON.stringify(centers, null, 2));

  console.log('\n=== SUPERVISORS ===');
  var sups = await query('supervisors?select=user_id,center_id,full_name,email');
  console.log(JSON.stringify(sups, null, 2));

  console.log('\n=== ASSESSMENTS ===');
  var ass = await query('assessments?select=id,name,exam_date');
  console.log(JSON.stringify(ass, null, 2));

  console.log('\n=== EXAMINEES ===');
  var ex = await query('examinees?select=id,center_id,assessment_id,full_name');
  console.log(JSON.stringify(ex, null, 2));
}

main().catch(console.error);
