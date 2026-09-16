-- Migration: Fix RLS on admins table and RPC function
-- 
-- Problem 1: RLS circular dependency on admins table
--   The existing policy uses is_admin() which queries the admins table itself.
--   This means a freshly logged-in user can't read their admin profile.
-- Fix: Add a self-read policy based on auth_id = auth.uid() directly.
--
-- Problem 2: gen_random_bytes not found in RPC function
--   The repondre_invitation function uses gen_random_bytes without schema prefix.
-- Fix: Use extensions.gen_random_bytes(32).

-- Fix 1: Allow authenticated users to read their OWN admin profile
-- (avoids the circular dependency of is_admin())
DROP POLICY IF EXISTS "admin_read_own_profile" ON admins;
CREATE POLICY "admin_read_own_profile" ON admins
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Fix 2: Recreate the RPC function with the correct extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION repondre_invitation(
  p_jeton text,
  p_statut text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation record;
  v_qr_token text;
  v_now timestamptz := now();
BEGIN
  -- 1. Validation du statut demandé
  IF p_statut NOT IN ('confirmee', 'refusee') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_status',
      'message', 'Statut invalide. Utilisez "confirmee" ou "refusee".'
    );
  END IF;

  -- 2. Recherche de l'invitation associée au jeton
  SELECT id, statut, date_limite_confirmation
  INTO v_invitation
  FROM invitations
  WHERE jeton_unique = p_jeton;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invitation_not_found',
      'message', 'Invitation introuvable pour ce jeton.'
    );
  END IF;

  -- 3. Vérification de la date limite (règle stricte côté serveur)
  IF v_now > v_invitation.date_limite_confirmation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'deadline_passed',
      'message', 'La date limite de confirmation est dépassée.'
    );
  END IF;

  -- 4. Règle d'irrévocabilité
  IF v_invitation.statut <> 'en_attente' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'already_answered',
      'message', 'Une réponse a déjà été enregistrée pour cette invitation.'
    );
  END IF;

  -- 5. Traitement selon la confirmation ou le refus
  IF p_statut = 'confirmee' THEN
    -- Génération sécurisée du jeton QR (extensions.gen_random_bytes est pgcrypto)
    v_qr_token := encode(extensions.gen_random_bytes(32), 'hex');

    UPDATE invitations
    SET statut = 'confirmee', date_reponse = v_now
    WHERE id = v_invitation.id;

    INSERT INTO qr_codes (invitation_id, jeton_qr_unique, genere_le, scanne)
    VALUES (v_invitation.id, v_qr_token, v_now, false)
    ON CONFLICT (invitation_id) DO UPDATE
    SET jeton_qr_unique = EXCLUDED.jeton_qr_unique,
        genere_le = v_now,
        scanne = false,
        scanne_le = NULL,
        scanne_par = NULL;

    RETURN jsonb_build_object(
      'success', true,
      'statut', 'confirmee',
      'qr_token', v_qr_token,
      'message', 'Présence confirmée avec succès.'
    );

  ELSE
    UPDATE invitations
    SET statut = 'refusee', date_reponse = v_now
    WHERE id = v_invitation.id;

    DELETE FROM qr_codes WHERE invitation_id = v_invitation.id;

    RETURN jsonb_build_object(
      'success', true,
      'statut', 'refusee',
      'message', 'Absence enregistrée.'
    );
  END IF;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION repondre_invitation(text, text) TO anon, authenticated;
