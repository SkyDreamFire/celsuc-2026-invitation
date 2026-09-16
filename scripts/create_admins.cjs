// scripts/create_admins.cjs
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Lecture manuelle du .env sans dépendance externe
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Erreur : VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE manquant dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const admins = [
  { email: 'admin1@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 1' },
  { email: 'admin2@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 2' },
  { email: 'admin3@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 3' },
  { email: 'admin4@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 4' },
  { email: 'admin5@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 5' },
  { email: 'admin6@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 6' },
  { email: 'admin7@celsuc.iuc', password: 'AdminIUC123', name: 'Administrateur 7' },
];

(async () => {
  console.log('🚀 Début de la configuration des comptes administrateurs...');

  // 1. Lister les utilisateurs existants
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Impossible de lister les utilisateurs:', listError.message);
  }

  const existingUsers = usersData?.users || [];

  for (const { email, password, name } of admins) {
    const existing = existingUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      console.log(`ℹ️ L'utilisateur ${email} existe déjà (ID: ${existing.id}). Mise à jour...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { name, role: 'admin' }
      });

      if (updateError) {
        console.error(`❌ Échec mise à jour pour ${email}:`, updateError.message);
      } else {
        console.log(`✅ ${email} mis à jour avec succès.`);
      }
    } else {
      console.log(`➕ Création de ${email}...`);
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'admin' }
      });

      if (error) {
        console.error(`❌ Échec création pour ${email}:`, error.message);
      } else {
        console.log(`✅ ${email} créé avec succès (ID: ${data.user?.id}).`);
      }
    }
  }

  console.log('🎉 Tous les comptes administrateurs ont été vérifiés/créés !');
  process.exit(0);
})();
