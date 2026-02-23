const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZHN4aGdzcG1sbHdzanBvdHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ4MzU0OCwiZXhwIjoyMDg3MDU5NTQ4fQ.-YewfEclZ93v9tPAsc8RiWnXxra8hlIDz7-Nlccrrao';
const HOST = 'wxdsxhgspmllwsjpotzy.supabase.co';

function restQuery(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      path: '/rest/v1/' + path,
      method: method,
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Use the Supabase SQL endpoint (pg-meta)
function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: HOST,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Try to create assessments table via RPC
  console.log('Step 1: Trying to create assessments table via RPC...');
  var r = await runSQL("CREATE TABLE IF NOT EXISTS assessments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, exam_date DATE, created_by UUID, created_at TIMESTAMPTZ DEFAULT now())");
  console.log('RPC result:', r.status, JSON.stringify(r.data).substring(0, 200));

  // If RPC doesn't work, we need another approach
  // Let's check if we can use the pg-meta API
  console.log('\nStep 2: Trying pg-meta SQL endpoint...');
  var r2 = await new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    });
    const opts = {
      hostname: HOST,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  console.log('pg-meta result:', r2.status, JSON.stringify(r2.data).substring(0, 300));

  // Step 3: Check what tables exist by querying information_schema
  console.log('\nStep 3: Checking tables via REST...');
  var tables = ['centers', 'supervisors', 'examinees', 'attendance_records', 'assessments', 'admins'];
  for (var t of tables) {
    var res = await restQuery('GET', t + '?select=id&limit=0', null);
    console.log('  ' + t + ': ' + (res.status === 200 ? 'EXISTS' : 'MISSING (status ' + res.status + ')'));
  }
}

main().catch(console.error);
