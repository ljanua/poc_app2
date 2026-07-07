require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query("SELECT email, role, status FROM users WHERE role = 'SystemAdmin' ORDER BY email");
  r.rows.forEach(row => console.log(row.email, '|', row.role, '|', row.status));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });