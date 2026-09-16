// scripts/create_admins.js
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const admins = [
  { email: 'admin1@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin2@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin3@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin4@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin5@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin6@celsuc.iuc', password: 'AdminIUC123' },
  { email: 'admin7@celsuc.iuc', password: 'AdminIUC123' },
];

(async () => {
  console.log('Creating admin users...');
  for (const { email, password } of admins) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      // optional: you can set role metadata if needed
    });
    if (error) {
      console.error(`❌ ${email}:`, error.message);
    } else {
      console.log(`✅ ${email} (id: ${data.id})`);
    }
  }
  console.log('Done.');
  process.exit(0);
})();
