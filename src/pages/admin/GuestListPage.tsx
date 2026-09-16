import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { InvitationStatus, Language } from '@/lib/types';
import { Search, Send, RotateCcw, Copy, Check, X } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({ nom: '', prenom: '', telephone: '', langue: 'fr' as Language, filiere_promotion: '' });
  const [submitting, setSubmitting] = useState(false);
  const canEdit = hasRole('super_admin', 'agent_accueil');

  const fetchGuests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select(`
        id, nom, prenom, telephone, langue, filiere_promotion,
        invitations!inner(id, jeton_unique, statut, date_reponse, qr_codes(id, scanne))
      `);
    if (data) {
      setGuests(data as unknown as GuestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  const filtered = guests.filter((g) => {
    const matchSearch =
      !search ||
      g.nom.toLowerCase().includes(search.toLowerCase()) ||
      g.prenom.toLowerCase().includes(search.toLowerCase()) ||
      g.telephone.includes(search);
    const matchStatus = filterStatus === 'all' || g.invitation?.statut === filterStatus;
    return matchSearch && matchStatus;
  });

  const copyLink = (jeton: string, id: string) => {
    const link = `${window.location.origin}/#/invitation/${jeton}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddStudent = async () => {
    if (!newStudent.nom || !newStudent.prenom || !newStudent.telephone) return;
    setSubmitting(true);
    const { data: student } = await supabase.from('students').insert({
      nom: newStudent.nom,
      prenom: newStudent.prenom,
      telephone: newStudent.telephone,
      langue: newStudent.langue,
      filiere_promotion: newStudent.filiere_promotion,
    }).select().single();

    if (student) {
      await supabase.from('invitations').insert({
        student_id: student.id,
        jeton_unique: crypto.randomUUID() + crypto.randomUUID(),
        statut: 'en_attente',
      });
    }
    setNewStudent({ nom: '', prenom: '', telephone: '', langue: 'fr', filiere_promotion: '' });
    setShowAdd(false);
    setSubmitting(false);
    fetchGuests();
  };

  const handleCancelResponse = async (invitationId: string) => {
    if (!confirm(t('confirmAction'))) return;
    await supabase.from('invitations').update({ statut: 'en_attente', date_reponse: null }).eq('id', invitationId);
    await supabase.from('qr_codes').delete().eq('invitation_id', invitationId);
    fetchGuests();
  };

  const handleRegenerate = async (invitationId: string) => {
    if (!confirm(t('confirmAction'))) return;
    const newToken = crypto.randomUUID() + crypto.randomUUID();
    await supabase.from('invitations').update({ jeton_unique: newToken, statut: 'en_attente', date_reponse: null }).eq('id', invitationId);
    await supabase.from('qr_codes').delete().eq('invitation_id', invitationId);
    fetchGuests();
  };

  const handleSendWhatsApp = async (invitationId: string, prenom: string, langue: Language, jeton: string) => {
    const { data: settings } = await supabase.from('event_settings').select('*').limit(1).maybeSingle();
    if (!settings) return;
    const template = langue === 'fr' ? settings.whatsapp_template_fr : settings.whatsapp_template_en;
    const link = `${window.location.origin}/#/invitation/${jeton}`;
    const content = template
      .replace('{prenom}', prenom)
      .replace('{lien}', link)
      .replace('{date_evenement}', new Date(settings.date_evenement).toLocaleDateString())
      .replace('{lieu}', settings.lieu)
      .replace('{date_limite}', new Date(settings.date_limite_confirmation).toLocaleDateString());
    await supabase.from('whatsapp_queue').insert({ invitation_id: invitationId, contenu: content, statut: 'en_attente' });
    alert(t('whatsappSent'));
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmee: 'bg-[#33A944]/10 text-[#33A944]',
      refusee: 'bg-[#CF181C]/10 text-[#CF181C]',
      en_attente: 'bg-gray-100 text-gray-600',
      expiree: 'bg-yellow-100 text-yellow-700',
    };
    const labels: Record<string, string> = {
      confirmee: t('confirmed'),
      refusee: t('refused'),
      en_attente: t('pending'),
      expiree: t('expired'),
    };
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <AdminLayout title={t('guestList')}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchGuests')}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#33A944] focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#33A944] focus:border-transparent outline-none"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="en_attente">{t('pending')}</option>
            <option value="confirmee">{t('confirmed')}</option>
            <option value="refusee">{t('refused')}</option>
          </select>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2.5 bg-[#33A944] text-white rounded-xl text-sm font-semibold hover:bg-[#2a8a38] transition-colors whitespace-nowrap"
            >
              {t('addGuest')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">{t('noResults')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('name')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">{t('phone')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">{t('language')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('status')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">QR</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{g.prenom} {g.nom}</p>
                        {g.filiere_promotion && <p className="text-xs text-gray-400">{g.filiere_promotion}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{g.telephone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{g.langue.toUpperCase()}</td>
                      <td className="px-4 py-3">{g.invitation ? statusBadge(g.invitation.statut) : '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {g.invitation?.qr_codes && g.invitation.qr_codes.length > 0 ? (
                          <span className={`text-xs ${g.invitation.qr_codes[0].scanne ? 'text-[#33A944] font-semibold' : 'text-gray-400'}`}>
                            {g.invitation.qr_codes[0].scanne ? t('present') : t('notScanned')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {g.invitation && (
                            <>
                              <button
                                onClick={() => copyLink(g.invitation!.jeton_unique, g.id)}
                                title={t('copyLink')}
                                className="p-1.5 text-gray-400 hover:text-[#33A944] hover:bg-[#33A944]/10 rounded-lg transition-colors"
                              >
                                {copiedId === g.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => handleSendWhatsApp(g.invitation!.id, g.prenom, g.langue, g.invitation!.jeton_unique)}
                                    title={t('sendWhatsapp')}
                                    className="p-1.5 text-gray-400 hover:text-[#33A944] hover:bg-[#33A944]/10 rounded-lg transition-colors"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                  {g.invitation.statut !== 'en_attente' && (
                                    <button
                                      onClick={() => handleCancelResponse(g.invitation!.id)}
                                      title={t('cancelResponse')}
                                      className="p-1.5 text-gray-400 hover:text-[#CF181C] hover:bg-[#CF181C]/10 rounded-lg transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRegenerate(g.invitation!.id)}
                                    title={t('regenerateInvitation')}
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            {filtered.length} {t('entries')}
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4">{t('addStudent')}</h3>
            <div className="space-y-3">
              <input type="text" placeholder={t('firstName')} value={newStudent.prenom} onChange={(e) => setNewStudent({ ...newStudent, prenom: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <input type="text" placeholder={t('name')} value={newStudent.nom} onChange={(e) => setNewStudent({ ...newStudent, nom: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <input type="text" placeholder={t('phone')} value={newStudent.telephone} onChange={(e) => setNewStudent({ ...newStudent, telephone: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <input type="text" placeholder={t('fieldPromotion')} value={newStudent.filiere_promotion} onChange={(e) => setNewStudent({ ...newStudent, filiere_promotion: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <select value={newStudent.langue} onChange={(e) => setNewStudent({ ...newStudent, langue: e.target.value as Language })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]">
                <option value="fr">{t('languageFr')}</option>
                <option value="en">{t('languageEn')}</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200">{t('cancel')}</button>
              <button onClick={handleAddStudent} disabled={submitting} className="flex-1 py-2.5 bg-[#33A944] text-white rounded-xl font-semibold text-sm hover:bg-[#2a8a38] disabled:opacity-50">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
