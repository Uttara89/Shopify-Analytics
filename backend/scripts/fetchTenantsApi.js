import fetch from 'node-fetch';

async function main(){
  const res = await fetch('http://localhost:3000/tenants');
  const data = await res.json();
  console.log(`HTTP ${res.status} - got ${Array.isArray(data) ? data.length : 'unknown'} item(s)`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
