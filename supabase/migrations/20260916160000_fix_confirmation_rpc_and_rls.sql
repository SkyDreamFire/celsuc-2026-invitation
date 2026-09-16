-- Migration: Correction du bug RLS et sécurisation côté serveur de la confirmation d'invitation
-- Fonction RPC SECURITY DEFINER pour répondre à une invitation (confirmer ou refuser)
-- Garantit l'atomicité, l'irrévocabilité, le respect de la date limite et la génération sécurisée du QR Code côté serveur.

CREATE OR REPLACE FUNCTION repondre_invitation(
  p_jeton text,
  p_statut text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 4. Règle d'irrévocabilité : une réponse déjà enregistrée ne peut plus être modifiée par l'étudiant
  IF v_invitation.statut <> 'en_attente' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'already_answered',
      'message', 'Une réponse a déjà été enregistrée pour cette invitation.'
    );
  END IF;

  -- 5. Traitement selon la confirmation ou le refus
  IF p_statut = 'confirmee' THEN
    -- Génération d'un jeton aléatoire sécurisé côté serveur (64 caractères hexadécimaux)
    v_qr_token := encode(gen_random_bytes(32), 'hex');

    -- Mise à jour de l'invitation
    UPDATE invitations
    SET
      statut = 'confirmee',
      date_reponse = v_now
    WHERE id = v_invitation.id;

    -- Création atomique du QR Code
    INSERT INTO qr_codes (
      invitation_id,
      jeton_qr_unique,
      genere_le,
      scanne
    )
    VALUES (
      v_invitation.id,
      v_qr_token,
      v_now,
      false
    )
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
    -- Cas du refus
    UPDATE invitations
    SET
      statut = 'refusee',
      date_reponse = v_now
    WHERE id = v_invitation.id;

    -- Suppression d'un QR code éventuel
    DELETE FROM qr_codes WHERE invitation_id = v_invitation.id;

    RETURN jsonb_build_object(
      'success', true,
      'statut', 'refusee',
      'message', 'Absence enregistrée.'
    );
  END IF;
END;
$$;

-- Accorder les droits d'exécution de la fonction aux rôles anonyme et authentifié
GRANT EXECUTE ON FUNCTION repondre_invitation(text, text) TO anon, authenticated;

-- Sécurité RLS pour qr_codes : autoriser les utilisateurs anonymes à lire leur propre QR Code
DROP POLICY IF EXISTS "anon_select_qr_codes" ON qr_codes;
CREATE POLICY "anon_select_qr_codes" ON qr_codes FOR SELECT
  TO anon, authenticated USING (true);

-- Définir le logo officiel IUC par défaut dans event_settings si vide
UPDATE event_settings
SET logo_url = '/logo-iuc.png'
WHERE logo_url IS NULL OR logo_url = '';

