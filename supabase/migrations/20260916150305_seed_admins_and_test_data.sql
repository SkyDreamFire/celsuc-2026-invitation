/*
# CELSUC 2026 — Create 7 admin accounts and seed data

1. Auth users
- Creates 7 Supabase Auth users: admin1@celsuc.iuc to admin7@celsuc.iuc
- All with password "AdminIUC123"
- Creates corresponding admins table entries with roles

2. Seed data
- Creates test students with invitations and QR codes
- Inserts default event_settings row

3. Notes
- Uses auth.users insert with crypt() for password hashing
- Admin1 = super_admin, Admin2-3 = agent_accueil, Admin4-7 = consultation
*/

-- Insert default event settings if not exists
INSERT INTO event_settings (id, nom_evenement, date_evenement, heure_debut, heure_fin, lieu, dress_code, date_limite_confirmation, logo_url, langue_par_defaut)
SELECT gen_random_uuid(), 'CELSUC 2026', '2026-09-19', '17:00', '22:00', 'IUC Campus de Dschang', 'Black and White', '2026-09-18 23:59:59+01', '/logo-iuc.png', 'fr'
WHERE NOT EXISTS (SELECT 1 FROM event_settings);

-- Create 7 admin auth users
DO $$
DECLARE
  admin_emails text[] := ARRAY['admin1@celsuc.iuc','admin2@celsuc.iuc','admin3@celsuc.iuc','admin4@celsuc.iuc','admin5@celsuc.iuc','admin6@celsuc.iuc','admin7@celsuc.iuc'];
  admin_names text[] := ARRAY['Admin1','Admin2','Admin3','Admin4','Admin5','Admin6','Admin7'];
  admin_roles text[] := ARRAY['super_admin','agent_accueil','agent_accueil','consultation','consultation','consultation','consultation'];
  i int;
  user_id uuid;
  existing_count int;
BEGIN
  FOR i IN 1..7 LOOP
    -- Check if user already exists
    SELECT count(*) INTO existing_count FROM auth.users WHERE email = admin_emails[i];
    IF existing_count = 0 THEN
      -- Insert into auth.users with encrypted password
      user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data
      ) VALUES (
        user_id,
        'authenticated',
        'authenticated',
        admin_emails[i],
        crypt('AdminIUC123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb
      );
      
      -- Insert into admins table
      INSERT INTO admins (auth_id, nom, email, role)
      SELECT user_id, admin_names[i], admin_emails[i], admin_roles[i]
      WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = admin_emails[i]);
    END IF;
  END LOOP;
END $$;

-- Create test students with invitations
DO $$
DECLARE
  s1_id uuid;
  s2_id uuid;
  s3_id uuid;
  inv1_id uuid;
  inv2_id uuid;
  inv3_id uuid;
  settings_id uuid;
  settings_deadline timestamptz;
BEGIN
  SELECT id INTO settings_id FROM event_settings LIMIT 1;
  SELECT date_limite_confirmation INTO settings_deadline FROM event_settings LIMIT 1;

  -- Student 1: French, confirmed
  INSERT INTO students (id, nom, prenom, telephone, langue, filiere_promotion)
  VALUES (gen_random_uuid(), 'Kamga', 'Pierre', '+237 699 12 34 56', 'fr', 'Informatique 2024')
  RETURNING id INTO s1_id;

  -- Student 2: English, confirmed
  INSERT INTO students (id, nom, prenom, telephone, langue, filiere_promotion)
  VALUES (gen_random_uuid(), 'Foka', 'Marie', '+237 677 98 76 54', 'en', 'Management 2024')
  RETURNING id INTO s2_id;

  -- Student 3: French, pending
  INSERT INTO students (id, nom, prenom, telephone, langue, filiere_promotion)
  VALUES (gen_random_uuid(), 'Nkomo', 'Jean', '+237 690 55 44 33', 'fr', 'Droit 2023')
  RETURNING id INTO s3_id;

  -- Invitation 1: confirmed with QR code
  inv1_id := gen_random_uuid();
  INSERT INTO invitations (id, student_id, jeton_unique, statut, date_reponse, date_limite_confirmation)
  VALUES (inv1_id, s1_id, encode(gen_random_bytes(32), 'hex'), 'confirmee', now(), settings_deadline);

  INSERT INTO qr_codes (invitation_id, jeton_qr_unique)
  VALUES (inv1_id, encode(gen_random_bytes(32), 'hex'));

  -- Invitation 2: confirmed with QR code
  inv2_id := gen_random_uuid();
  INSERT INTO invitations (id, student_id, jeton_unique, statut, date_reponse, date_limite_confirmation)
  VALUES (inv2_id, s2_id, encode(gen_random_bytes(32), 'hex'), 'confirmee', now(), settings_deadline);

  INSERT INTO qr_codes (invitation_id, jeton_qr_unique)
  VALUES (inv2_id, encode(gen_random_bytes(32), 'hex'));

  -- Invitation 3: pending, no QR
  inv3_id := gen_random_uuid();
  INSERT INTO invitations (id, student_id, jeton_unique, statut, date_limite_confirmation)
  VALUES (inv3_id, s3_id, encode(gen_random_bytes(32), 'hex'), 'en_attente', settings_deadline);

  -- Add WhatsApp queue entries
  INSERT INTO whatsapp_queue (invitation_id, contenu, statut)
  VALUES (inv1_id, 'Bonjour Pierre, vous êtes invité(e) à la soirée CELSUC 2026 le 2026-09-19 à IUC Campus de Dschang. Confirmez votre présence avant le 18/09/2026 23:59 via ce lien: https://celsuc.iuc/invitation/' || (SELECT jeton_unique FROM invitations WHERE id = inv1_id), 'envoye');

  INSERT INTO whatsapp_queue (invitation_id, contenu, statut)
  VALUES (inv2_id, 'Hello Marie, you are invited to the CELSUC 2026 gala on 2026-09-19 at IUC Campus de Dschang. Confirm your attendance before 18/09/2026 23:59 via this link: https://celsuc.iuc/invitation/' || (SELECT jeton_unique FROM invitations WHERE id = inv2_id), 'envoye');

  INSERT INTO whatsapp_queue (invitation_id, contenu, statut)
  VALUES (inv3_id, 'Bonjour Jean, vous êtes invité(e) à la soirée CELSUC 2026 le 2026-09-19 à IUC Campus de Dschang. Confirmez votre présence avant le 18/09/2026 23:59 via ce lien: https://celsuc.iuc/invitation/' || (SELECT jeton_unique FROM invitations WHERE id = inv3_id), 'en_attente');
END $$;
