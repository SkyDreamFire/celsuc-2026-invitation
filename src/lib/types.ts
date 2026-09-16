export type Language = 'fr' | 'en';

export type InvitationStatus = 'en_attente' | 'confirmee' | 'refusee' | 'expiree';
export type WhatsAppStatus = 'en_attente' | 'envoye' | 'echec';
export type AdminRole = 'super_admin' | 'agent_accueil' | 'consultation';
export type ScanResult = 'valide_premier_scan' | 'deja_scanne' | 'invalide';

export interface EventSettings {
  id: string;
  nom_evenement: string;
  date_evenement: string;
  heure_debut: string;
  heure_fin: string;
  lieu: string;
  dress_code: string;
  date_limite_confirmation: string;
  logo_url: string;
  langue_par_defaut: Language;
  programme_fr: string[];
  programme_en: string[];
  whatsapp_template_fr: string;
  whatsapp_template_en: string;
}

export interface Student {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  langue: Language;
  filiere_promotion: string;
  created_at: string;
}

export interface Admin {
  id: string;
  auth_id: string | null;
  nom: string;
  email: string;
  role: AdminRole;
  created_at: string;
}

export interface Invitation {
  id: string;
  student_id: string;
  jeton_unique: string;
  statut: InvitationStatus;
  date_reponse: string | null;
  date_limite_confirmation: string;
  created_at: string;
}

export interface QrCode {
  id: string;
  invitation_id: string;
  jeton_qr_unique: string;
  genere_le: string;
  scanne: boolean;
  scanne_le: string | null;
  scanne_par: string | null;
}

export interface WhatsAppQueueItem {
  id: string;
  invitation_id: string;
  contenu: string;
  statut: WhatsAppStatus;
  tentative_envoi_le: string | null;
  erreur: string | null;
  created_at: string;
}

export interface ScanLog {
  id: string;
  qr_code_id: string;
  admin_id: string;
  resultat: ScanResult;
  horodatage: string;
}

export interface InvitationWithStudent extends Invitation {
  students: Pick<Student, 'nom' | 'prenom' | 'telephone' | 'langue' | 'filiere_promotion'>;
}

export interface QrCodeWithInvitation extends QrCode {
  invitations: {
    id: string;
    student_id: string;
    statut: string;
    students: Pick<Student, 'nom' | 'prenom'>;
  };
}
