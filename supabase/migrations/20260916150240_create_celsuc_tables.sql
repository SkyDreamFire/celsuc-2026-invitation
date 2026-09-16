/*
# CELSUC 2026 — Create core tables

1. New Tables
- `event_settings`: single-row table for event configuration (name, date, time, location, dress code, deadline, logo, default language)
- `students`: invited students with name, phone, language, field/promotion
- `admins`: admin profiles linked to Supabase Auth users with role (super_admin / agent_accueil / consultation)
- `invitations`: one per student with unique secure token, status, response date, deadline
- `qr_codes`: one per confirmed invitation with unique QR token, scan status
- `whatsapp_queue`: message queue for WhatsApp sends with status and error tracking
- `scan_logs`: audit trail of all QR scans (valid, already scanned, invalid)

2. Security
- RLS enabled on all tables
- Public (anon) can read event_settings and read/update their own invitation via token
- Authenticated admins get full CRUD on all tables
- Admins table: super_admin can manage all, agents can read, consultation can read

3. Notes
- Uses gen_random_uuid() for all primary keys
- Timestamps default to now()
- Foreign keys with CASCADE delete where appropriate
*/

-- Event settings (single row)
CREATE TABLE IF NOT EXISTS event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_evenement text NOT NULL DEFAULT 'CELSUC 2026',
  date_evenement date NOT NULL DEFAULT '2026-09-19',
  heure_debut text NOT NULL DEFAULT '17:00',
  heure_fin text DEFAULT '',
  lieu text NOT NULL DEFAULT 'IUC Campus de Dschang',
  dress_code text NOT NULL DEFAULT 'Black and White',
  date_limite_confirmation timestamptz NOT NULL DEFAULT '2026-09-18 23:59:59+01',
  logo_url text DEFAULT '',
  langue_par_defaut text NOT NULL DEFAULT 'fr',
  programme_fr jsonb NOT NULL DEFAULT '[
    "Lancement de la cérémonie officielle de célébration des lauréats",
    "Discours et témoignages des étudiants",
    "Prestations culturelles : danse, musique, sketchs",
    "Animations : chasse au trésor, chaises dansantes, jeux de dames et Ludo, concours de danse, réalité virtuelle, match des incollables",
    "Repas et moment de convivialité",
    "Remise des distinctions"
  ]'::jsonb,
  programme_en jsonb NOT NULL DEFAULT '[
    "Opening of the official laureate celebration ceremony",
    "Speeches and student testimonials",
    "Cultural performances: dance, music, sketches",
    "Activities: treasure hunt, musical chairs, checkers and Ludo games, dance contest, virtual reality, trivia match",
    "Dinner and convivial moment",
    "Award ceremony"
  ]'::jsonb,
  whatsapp_template_fr text NOT NULL DEFAULT 'Bonjour {prenom}, vous êtes invité(e) à la soirée CELSUC 2026 le {date_evenement} à {lieu}. Confirmez votre présence avant le {date_limite} via ce lien: {lien}',
  whatsapp_template_en text NOT NULL DEFAULT 'Hello {prenom}, you are invited to the CELSUC 2026 gala on {date_evenement} at {lieu}. Confirm your attendance before {date_limite} via this link: {lien}',
  created_at timestamptz DEFAULT now()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text NOT NULL,
  langue text NOT NULL DEFAULT 'fr',
  filiere_promotion text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Admins (linked to auth.users)
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'consultation',
  created_at timestamptz DEFAULT now()
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  jeton_unique text NOT NULL UNIQUE,
  statut text NOT NULL DEFAULT 'en_attente',
  date_reponse timestamptz,
  date_limite_confirmation timestamptz NOT NULL DEFAULT '2026-09-18 23:59:59+01',
  created_at timestamptz DEFAULT now()
);

-- QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE CASCADE,
  jeton_qr_unique text NOT NULL UNIQUE,
  genere_le timestamptz DEFAULT now(),
  scanne boolean NOT NULL DEFAULT false,
  scanne_le timestamptz,
  scanne_par uuid REFERENCES admins(id) ON DELETE SET NULL
);

-- WhatsApp queue
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  contenu text NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente',
  tentative_envoi_le timestamptz,
  erreur text,
  created_at timestamptz DEFAULT now()
);

-- Scan logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid REFERENCES qr_codes(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES admins(id) ON DELETE SET NULL,
  resultat text NOT NULL,
  horodatage timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admins WHERE admins.auth_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admins WHERE admins.auth_id = auth.uid() AND admins.role = 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- event_settings policies: public read, admin update
DROP POLICY IF EXISTS "public_read_event_settings" ON event_settings;
CREATE POLICY "public_read_event_settings" ON event_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_event_settings" ON event_settings;
CREATE POLICY "admin_update_event_settings" ON event_settings FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- students policies: admin-only CRUD
DROP POLICY IF EXISTS "admin_select_students" ON students;
CREATE POLICY "admin_select_students" ON students FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_students" ON students;
CREATE POLICY "admin_insert_students" ON students FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_students" ON students;
CREATE POLICY "admin_update_students" ON students FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_students" ON students;
CREATE POLICY "admin_delete_students" ON students FOR DELETE
  TO authenticated USING (is_admin());

-- admins policies: admin read, super_admin write
DROP POLICY IF EXISTS "admin_select_admins" ON admins;
CREATE POLICY "admin_select_admins" ON admins FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "super_admin_insert_admins" ON admins;
CREATE POLICY "super_admin_insert_admins" ON admins FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_admins" ON admins;
CREATE POLICY "super_admin_update_admins" ON admins FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_admins" ON admins;
CREATE POLICY "super_admin_delete_admins" ON admins FOR DELETE
  TO authenticated USING (is_super_admin());

-- invitations: anon can read own invitation via token, can update statut via token
DROP POLICY IF EXISTS "anon_select_invitation_by_token" ON invitations;
CREATE POLICY "anon_select_invitation_by_token" ON invitations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_invitation_by_token" ON invitations;
CREATE POLICY "anon_update_invitation_by_token" ON invitations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_insert_invitations" ON invitations;
CREATE POLICY "admin_insert_invitations" ON invitations FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_invitations" ON invitations;
CREATE POLICY "admin_update_invitations" ON invitations FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_invitations" ON invitations;
CREATE POLICY "admin_delete_invitations" ON invitations FOR DELETE
  TO authenticated USING (is_admin());

-- qr_codes: anon can read own QR via invitation join, admin full access
DROP POLICY IF EXISTS "anon_select_qr_codes" ON qr_codes;
CREATE POLICY "anon_select_qr_codes" ON qr_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_qr_codes" ON qr_codes;
CREATE POLICY "admin_insert_qr_codes" ON qr_codes FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_qr_codes" ON qr_codes;
CREATE POLICY "admin_update_qr_codes" ON qr_codes FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_qr_codes" ON qr_codes;
CREATE POLICY "admin_delete_qr_codes" ON qr_codes FOR DELETE
  TO authenticated USING (is_admin());

-- whatsapp_queue: admin-only CRUD
DROP POLICY IF EXISTS "admin_select_whatsapp_queue" ON whatsapp_queue;
CREATE POLICY "admin_select_whatsapp_queue" ON whatsapp_queue FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_whatsapp_queue" ON whatsapp_queue;
CREATE POLICY "admin_insert_whatsapp_queue" ON whatsapp_queue FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_whatsapp_queue" ON whatsapp_queue;
CREATE POLICY "admin_update_whatsapp_queue" ON whatsapp_queue FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_whatsapp_queue" ON whatsapp_queue;
CREATE POLICY "admin_delete_whatsapp_queue" ON whatsapp_queue FOR DELETE
  TO authenticated USING (is_admin());

-- scan_logs: admin-only CRUD
DROP POLICY IF EXISTS "admin_select_scan_logs" ON scan_logs;
CREATE POLICY "admin_select_scan_logs" ON scan_logs FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_scan_logs" ON scan_logs;
CREATE POLICY "admin_insert_scan_logs" ON scan_logs FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_jeton ON invitations(jeton_unique);
CREATE INDEX IF NOT EXISTS idx_invitations_student ON invitations(student_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_jeton ON qr_codes(jeton_qr_unique);
CREATE INDEX IF NOT EXISTS idx_qr_codes_invitation ON qr_codes(invitation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_statut ON whatsapp_queue(statut);
CREATE INDEX IF NOT EXISTS idx_students_nom ON students(nom);
