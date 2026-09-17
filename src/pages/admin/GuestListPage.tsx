import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { InvitationStatus, Language, EventSettings } from '@/lib/types';
import {
  Search,
  Send,
  RotateCcw,
  Copy,
  Check,
  X,
  ExternalLink,
  MessageSquare,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Share2
} from 'lucide-react';

interface GuestRow {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  langue: Language;
  filiere_promotion: string;
  invitation: {
    id: string;
    jeton_unique: string;
    statut: InvitationStatus;
    date_reponse: string | null;
    qr_codes: { id: string; scanne: boolean }[];
  } | null;
}

export function GuestListPage() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [newStudent, setNewStudent] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    langue: 'fr' as Language,
    filiere_promotion: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const canEdit = hasRole('super_admin', 'agent_accueil');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchGuestsAndSettings = async () => {
    setLoading(true);
    const [studentsRes, settingsRes] = await Promise.all([
      supabase
        .from('students')
        .select(`
          id, nom, prenom, telephone, langue, filiere_promotion,
          invitations(id, jeton_unique, statut, date_reponse, qr_codes(id, scanne))
        `)
        .order('nom', { ascending: true }),
      supabase.from('event_settings').select('*').limit(1).maybeSingle(),
    ]);

    if (settingsRes.data) {
      setSettings(settingsRes.data as EventSettings);
    }

    if (studentsRes.data) {
      const mapped: GuestRow[] = studentsRes.data.map((s: any) => {
        const inv = Array.isArray(s.invitations) ? s.invitations[0] : s.invitations;
        let qrList: { id: string; scanne: boolean }[] = [];
        if (inv?.qr_codes) {
          qrList = Array.isArray(inv.qr_codes) ? inv.qr_codes : [inv.qr_codes];
        }

        return {
          id: s.id,
          nom: s.nom,
          prenom: s.prenom,
          telephone: s.telephone,
          langue: s.langue,
          filiere_promotion: s.filiere_promotion,
          invitation: inv
            ? {
                id: inv.id,
                jeton_unique: inv.jeton_unique,
                statut: inv.statut,
                date_reponse: inv.date_reponse,
                qr_codes: qrList,
              }
            : null,
        };
      });
      setGuests(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGuestsAndSettings();
  }, []);

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const matchSearch =
        !search ||
        g.nom.toLowerCase().includes(search.toLowerCase()) ||
        g.prenom.toLowerCase().includes(search.toLowerCase()) ||
        g.telephone.includes(search) ||
        (g.filiere_promotion && g.filiere_promotion.toLowerCase().includes(search.toLowerCase()));
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'en_attente' && (!g.invitation || g.invitation.statut === 'en_attente')) ||
        (filterStatus !== 'en_attente' && g.invitation?.statut === filterStatus);
      return matchSearch && matchStatus;
    });
  }, [guests, search, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: guests.length,
      pending: guests.filter((g) => !g.invitation || g.invitation?.statut === 'en_attente').length,
      confirmed: guests.filter((g) => g.invitation?.statut === 'confirmee').length,
      refused: guests.filter((g) => g.invitation?.statut === 'refusee').length,
    };
  }, [guests]);

  // Helper pour nettoyer et normaliser les numéros de téléphone camerounais/internationaux
  const formatPhoneForWhatsApp = (rawPhone: string) => {
    let clean = rawPhone.replace(/\D/g, '');
    // Si format national 9 chiffres commençant par 6 (ex: 699123456), ajouter code pays 237
    if (clean.length === 9 && (clean.startsWith('6') || clean.startsWith('2'))) {
      clean = '237' + clean;
    }
    return clean;
  };

  // Construction du message WhatsApp avec variables
  const buildWhatsAppMessage = (
    prenom: string,
    nom: string,
    langue: Language,
    jeton: string
  ) => {
    const fullName = `${prenom} ${nom}`.trim() || prenom;

    const defaultFr = `🎓✨ Bonjour {nom_complet} !

Vous êtes cordialement invité(e) à la grande soirée CELSUC 2026 🥳🎉

📅 Date : {date_evenement}
📍 Lieu : {lieu}
🕕 Heure : {heure_debut}
👔 Dress code : {dress_code}

🙏🏾 Merci de confirmer votre présence avant le {date_limite} via le lien ci-dessous :

🔗 {lien}

✨ Nous avons hâte de vous compter parmi nous ! 🥂🎊`;

    const defaultEn = `🎓✨ Hello {nom_complet} !

You are cordially invited to the grand CELSUC 2026 gala evening 🥳🎉

📅 Date: {date_evenement}
📍 Location: {lieu}
🕕 Time: {heure_debut}
👔 Dress code: {dress_code}

🙏🏾 Please confirm your attendance before {date_limite} via the link below:

🔗 {lien}

✨ We look forward to celebrating with you! 🥂🎊`;

    const template =
      langue === 'fr'
        ? settings?.whatsapp_template_fr || defaultFr
        : settings?.whatsapp_template_en || defaultEn;

    const link = `${window.location.origin}/#/invitation/${jeton}`;

    // Formatage des dates en lettres (ex: 19 septembre 2026)
    const dateEvent = settings?.date_evenement
      ? new Date(settings.date_evenement + 'T00:00:00').toLocaleDateString(
          langue === 'fr' ? 'fr-FR' : 'en-US',
          { day: 'numeric', month: 'long', year: 'numeric' }
        )
      : langue === 'fr'
      ? '19 septembre 2026'
      : 'September 19, 2026';

    const lieuEvent = settings?.lieu || 'IUC – Campus de Dschang';
    const heureDebut = settings?.heure_debut || '18 h 00';
    const dressCode = settings?.dress_code || 'Black or White 🖤🤍';

    const dateLimite = settings?.date_limite_confirmation
      ? new Date(settings.date_limite_confirmation).toLocaleDateString(
          langue === 'fr' ? 'fr-FR' : 'en-US',
          { day: 'numeric', month: 'long', year: 'numeric' }
        )
      : langue === 'fr'
      ? '18 septembre 2026'
      : 'September 18, 2026';

    return template
      .replace(/{nom_complet}/g, fullName)
      .replace(/{prenom}/g, fullName)
      .replace(/{nom}/g, nom)
      .replace(/{lien}/g, link)
      .replace(/{date_evenement}/g, dateEvent)
      .replace(/{lieu}/g, lieuEvent)
      .replace(/{heure_debut}/g, heureDebut)
      .replace(/{dress_code}/g, dressCode)
      .replace(/{date_limite}/g, dateLimite);
  };

  // Envoi WhatsApp individuel (ouvre WhatsApp Web / App et enregistre dans la queue)
  const handleSendWhatsApp = async (
    invitationId: string,
    prenom: string,
    nom: string,
    langue: Language,
    jeton: string,
    rawPhone: string
  ) => {
    const content = buildWhatsAppMessage(prenom, nom, langue, jeton);
    const cleanPhone = formatPhoneForWhatsApp(rawPhone);

    // 1. Enregistrer dans la table d'historique whatsapp_queue
    await supabase.from('whatsapp_queue').insert({
      invitation_id: invitationId,
      contenu: content,
      statut: 'envoye',
      tentative_envoi_le: new Date().toISOString(),
    });

    // 2. Ouvrir directement WhatsApp
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(content)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`;

    window.open(waUrl, '_blank');
    showToast(t('whatsappSent'));
  };

  // Copie de lien individuel
  const copyLink = (jeton: string, id: string) => {
    const link = `${window.location.origin}/#/invitation/${jeton}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    showToast(t('linkCopied'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copier tous les liens des invités filtrés
  const handleCopyAllLinks = () => {
    const lines = filtered
      .filter((g) => g.invitation)
      .map((g) => `${g.prenom} ${g.nom} (${g.telephone}) : ${window.location.origin}/#/invitation/${g.invitation!.jeton_unique}`)
      .join('\n\n');

    if (!lines) {
      alert('Aucun lien à copier.');
      return;
    }

    navigator.clipboard.writeText(lines);
    showToast('Tous les liens ont été copiés dans le presse-papier !');
  };

  // Créer une invitation pour un étudiant qui n'en a pas
  const handleCreateInvitation = async (studentId: string) => {
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('invitations').insert({
      student_id: studentId,
      jeton_unique: newToken,
      statut: 'en_attente',
    });

    if (error) {
      alert('Erreur lors de la création de l\'invitation: ' + error.message);
    } else {
      showToast('Invitation créée avec succès !');
      fetchGuestsAndSettings();
    }
  };

  // Ajouter un nouvel étudiant
  const handleAddStudent = async () => {
    if (!newStudent.nom || !newStudent.prenom || !newStudent.telephone) {
      alert('Veuillez renseigner le nom, prénom et numéro de téléphone.');
      return;
    }
    setSubmitting(true);
    const { data: student, error: sErr } = await supabase
      .from('students')
      .insert({
        nom: newStudent.nom,
        prenom: newStudent.prenom,
        telephone: newStudent.telephone,
        langue: newStudent.langue,
        filiere_promotion: newStudent.filiere_promotion,
      })
      .select()
      .single();

    if (sErr || !student) {
      alert("Erreur lors de l'ajout: " + (sErr?.message || 'Inconnue'));
      setSubmitting(false);
      return;
    }

    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await supabase.from('invitations').insert({
      student_id: student.id,
      jeton_unique: newToken,
      statut: 'en_attente',
    });

    setNewStudent({ nom: '', prenom: '', telephone: '', langue: 'fr', filiere_promotion: '' });
    setShowAdd(false);
    setSubmitting(false);
    showToast('Étudiant et invitation ajoutés avec succès !');
    fetchGuestsAndSettings();
  };

  // Annuler la réponse
  const handleCancelResponse = async (invitationId: string) => {
    if (!confirm(t('confirmAction') || 'Êtes-vous sûr de vouloir annuler cette réponse ?')) return;
    await supabase.from('invitations').update({ statut: 'en_attente', date_reponse: null }).eq('id', invitationId);
    await supabase.from('qr_codes').delete().eq('invitation_id', invitationId);
    showToast(t('responseCancelled'));
    fetchGuestsAndSettings();
  };

  // Régénérer le jeton
  const handleRegenerate = async (invitationId: string) => {
    if (!confirm(t('confirmAction') || 'Voulez-vous générer un nouveau lien pour cet invité ?')) return;
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await supabase.from('invitations').update({ jeton_unique: newToken, statut: 'en_attente', date_reponse: null }).eq('id', invitationId);
    await supabase.from('qr_codes').delete().eq('invitation_id', invitationId);
    showToast(t('invitationRegenerated'));
    fetchGuestsAndSettings();
  };

  // Statuts badge
  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmee: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      refusee: 'bg-rose-50 text-rose-700 border border-rose-200',
      en_attente: 'bg-amber-50 text-amber-700 border border-amber-200',
      expiree: 'bg-gray-100 text-gray-700 border border-gray-200',
    };
    const labels: Record<string, string> = {
      confirmee: t('confirmed'),
      refusee: t('refused'),
      en_attente: t('pending'),
      expiree: t('expired'),
    };
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status === 'confirmee' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        {status === 'refusee' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
        {status === 'en_attente' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
        {labels[status] || status}
      </span>
    );
  };

  const pendingGuests = guests.filter((g) => g.invitation && g.invitation.statut === 'en_attente');

  return (
    <AdminLayout title={t('guestList')}>
      <div className="space-y-5">
        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-medium animate-bounce">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Stats summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setFilterStatus('all')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              filterStatus === 'all'
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium opacity-80 mb-1">
              <span>{t('total')}</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </button>

          <button
            onClick={() => setFilterStatus('en_attente')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              filterStatus === 'en_attente'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium opacity-80 mb-1">
              <span>{t('pending')}</span>
              <Clock className={`w-4 h-4 ${filterStatus === 'en_attente' ? 'text-white/80' : 'text-amber-500'}`} />
            </div>
            <p className={`text-2xl font-bold ${filterStatus === 'en_attente' ? 'text-white' : 'text-amber-600'}`}>{stats.pending}</p>
          </button>

          <button
            onClick={() => setFilterStatus('confirmee')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              filterStatus === 'confirmee'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium opacity-80 mb-1">
              <span>{t('confirmed')}</span>
              <CheckCircle2 className={`w-4 h-4 ${filterStatus === 'confirmee' ? 'text-white/80' : 'text-emerald-500'}`} />
            </div>
            <p className={`text-2xl font-bold ${filterStatus === 'confirmee' ? 'text-white' : 'text-emerald-600'}`}>{stats.confirmed}</p>
          </button>

          <button
            onClick={() => setFilterStatus('refusee')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              filterStatus === 'refusee'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium opacity-80 mb-1">
              <span>{t('refused')}</span>
              <XCircle className={`w-4 h-4 ${filterStatus === 'refusee' ? 'text-white/80' : 'text-rose-500'}`} />
            </div>
            <p className={`text-2xl font-bold ${filterStatus === 'refusee' ? 'text-white' : 'text-rose-600'}`}>{stats.refused}</p>
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchGuests') || 'Rechercher par nom, prénom, téléphone...'}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#33A944] focus:border-transparent outline-none transition-all"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#33A944] focus:border-transparent outline-none font-medium text-gray-700"
            >
              <option value="all">{t('allStatuses')}</option>
              <option value="en_attente">{t('pending')}</option>
              <option value="confirmee">{t('confirmed')}</option>
              <option value="refusee">{t('refused')}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton d'envoi groupé WhatsApp */}
            {canEdit && (
              <button
                onClick={() => setShowBulkSend(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                title="Ouvrir la fenêtre d'envoi des invitations"
              >
                <Send className="w-4 h-4" />
                <span>{t('sendInvitations')}</span>
                {stats.pending > 0 && (
                  <span className="bg-emerald-800 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {stats.pending}
                  </span>
                )}
              </button>
            )}

            {/* Bouton copier tous les liens */}
            <button
              onClick={handleCopyAllLinks}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all"
              title="Copier les liens de tous les invités affichés"
            >
              <Share2 className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">{t('copyAllLinks')}</span>
            </button>

            {/* Bouton Ajouter invité */}
            {canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#33A944] text-white rounded-xl text-sm font-semibold hover:bg-[#2a8a38] shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addGuest')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="inline-block w-8 h-8 border-4 border-[#33A944] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="font-medium">{t('loading')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="font-medium">{t('noResults') || 'Aucun invité trouvé'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3.5">
                      {t('name')}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3.5 hidden md:table-cell">
                      {t('phone')}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3.5 hidden lg:table-cell">
                      {t('language')}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3.5">
                      {t('status')}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3.5 hidden lg:table-cell">
                      QR Code
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3.5">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Nom / Prénom */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-sm">
                            {g.prenom} {g.nom}
                          </span>
                          {g.filiere_promotion && (
                            <span className="text-xs text-gray-500 font-normal">
                              {g.filiere_promotion}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 md:hidden mt-0.5">
                            {g.telephone}
                          </span>
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td className="px-4 py-3.5 text-sm text-gray-600 font-mono hidden md:table-cell">
                        {g.telephone}
                      </td>

                      {/* Langue */}
                      <td className="px-4 py-3.5 text-xs text-gray-600 hidden lg:table-cell">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md font-semibold text-gray-700 uppercase">
                          {g.langue}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3.5">
                        {g.invitation ? statusBadge(g.invitation.statut) : (
                          <span className="text-xs text-gray-400 italic">Sans invitation</span>
                        )}
                      </td>

                      {/* QR Présence */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {g.invitation?.qr_codes && g.invitation.qr_codes.length > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                              g.invitation.qr_codes[0].scanne
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {g.invitation.qr_codes[0].scanne ? '✓ ' + t('present') : t('notScanned')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Boutons d'Action */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {g.invitation ? (
                            <>
                              {/* 1. Bouton Envoyer WhatsApp */}
                              {canEdit && (
                                <button
                                  onClick={() =>
                                    handleSendWhatsApp(
                                      g.invitation!.id,
                                      g.prenom,
                                      g.nom,
                                      g.langue,
                                      g.invitation!.jeton_unique,
                                      g.telephone
                                    )
                                  }
                                  title={t('sendWhatsapp')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-semibold border border-emerald-200 hover:border-emerald-600 transition-all shadow-xs"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </button>
                              )}

                              {/* 2. Bouton Copier le lien */}
                              <button
                                onClick={() => copyLink(g.invitation!.jeton_unique, g.id)}
                                title={t('copyLink')}
                                className="p-1.5 bg-gray-50 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-all border border-gray-200"
                              >
                                {copiedId === g.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>

                              {/* 3. Bouton Aperçu / Voir l'invitation */}
                              <a
                                href={`/#/invitation/${g.invitation.jeton_unique}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t('previewInvitation')}
                                className="p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-all border border-gray-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>

                              {/* 4. Actions supplémentaires (Annuler / Régénérer) */}
                              {canEdit && (
                                <>
                                  {g.invitation.statut !== 'en_attente' && (
                                    <button
                                      onClick={() => handleCancelResponse(g.invitation!.id)}
                                      title={t('cancelResponse')}
                                      className="p-1.5 bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded-lg transition-all border border-gray-200"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleRegenerate(g.invitation!.id)}
                                    title={t('regenerateInvitation')}
                                    className="p-1.5 bg-gray-50 hover:bg-amber-50 text-gray-500 hover:text-amber-600 rounded-lg transition-all border border-gray-200"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            /* Si l'étudiant n'a pas d'invitation générée */
                            canEdit && (
                              <button
                                onClick={() => handleCreateInvitation(g.id)}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-all"
                              >
                                {t('createInvitation')}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {filtered.length} / {guests.length} {t('entries')}
            </span>
            <span>CELSUC 2026</span>
          </div>
        </div>
      </div>

      {/* Modal d'envoi groupé des invitations WhatsApp */}
      {showBulkSend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{t('bulkSendWhatsapp')}</h3>
                  <p className="text-xs text-gray-500">
                    {pendingGuests.length} invité(s) en attente d'envoi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkSend(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 overflow-y-auto space-y-4 pr-1">
              {/* Message Template Preview */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <p className="text-xs font-bold uppercase text-emerald-800 tracking-wider mb-1">
                  Aperçu du message type :
                </p>
                <p className="text-xs text-emerald-950 font-mono whitespace-pre-line leading-relaxed">
                  {buildWhatsAppMessage('[Prénom]', '[Nom]', 'fr', 'ex-token-123456')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopyAllLinks}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>{t('copyAllLinks')}</span>
                </button>
              </div>

              {/* Guest list with quick 1-click WhatsApp buttons */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-100">
                  Envoi 1-clic par invité ({pendingGuests.length})
                </div>
                {pendingGuests.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    Toutes les invitations sont déjà confirmées ou refusées !
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {pendingGuests.map((g) => (
                      <div
                        key={g.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">
                            {g.prenom} {g.nom}
                          </p>
                          <p className="text-gray-400 font-mono">{g.telephone}</p>
                        </div>
                        <button
                          onClick={() =>
                            handleSendWhatsApp(
                              g.invitation!.id,
                              g.prenom,
                              g.nom,
                              g.langue,
                              g.invitation!.jeton_unique,
                              g.telephone
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Envoyer</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowBulkSend(false)}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-4">{t('addStudent')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('firstName')}</label>
                <input
                  type="text"
                  placeholder="Ex: Pierre"
                  value={newStudent.prenom}
                  onChange={(e) => setNewStudent({ ...newStudent, prenom: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('name')}</label>
                <input
                  type="text"
                  placeholder="Ex: Kamga"
                  value={newStudent.nom}
                  onChange={(e) => setNewStudent({ ...newStudent, nom: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('phone')}</label>
                <input
                  type="text"
                  placeholder="Ex: +237 699 12 34 56 ou 699123456"
                  value={newStudent.telephone}
                  onChange={(e) => setNewStudent({ ...newStudent, telephone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('fieldPromotion')}</label>
                <input
                  type="text"
                  placeholder="Ex: Informatique 2024"
                  value={newStudent.filiere_promotion}
                  onChange={(e) => setNewStudent({ ...newStudent, filiere_promotion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('language')}</label>
                <select
                  value={newStudent.langue}
                  onChange={(e) => setNewStudent({ ...newStudent, langue: e.target.value as Language })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                >
                  <option value="fr">{t('languageFr')}</option>
                  <option value="en">{t('languageEn')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddStudent}
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#33A944] text-white rounded-xl font-semibold text-sm hover:bg-[#2a8a38] transition-colors disabled:opacity-50"
              >
                {submitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
