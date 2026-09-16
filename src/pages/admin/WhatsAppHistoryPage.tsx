import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Send, RotateCcw, MessageSquare } from 'lucide-react';
import type { WhatsAppQueueItem } from '@/lib/types';

interface QueueItem extends WhatsAppQueueItem {
  invitations: {
    students: { prenom: string; nom: string };
  };
}

export function WhatsAppHistoryPage() {
  const { t, lang } = useLanguage();
  const { hasRole } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = hasRole('super_admin', 'agent_accueil');

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_queue')
      .select('*, invitations!inner(students(prenom, nom))')
      .order('created_at', { ascending: false });
    if (data) setItems(data as unknown as QueueItem[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleResend = async (item: QueueItem) => {
    await supabase
      .from('whatsapp_queue')
      .update({ statut: 'en_attente', erreur: null })
      .eq('id', item.id);
    fetchItems();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      envoye: 'bg-[#33A944]/10 text-[#33A944]',
      echec: 'bg-[#CF181C]/10 text-[#CF181C]',
      en_attente: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      envoye: t('invitationsDelivered'),
      echec: t('invitationsFailed'),
      en_attente: t('pending'),
    };
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <AdminLayout title={t('whatsappHistory')}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400">{t('noQueueItems')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {item.invitations?.students?.prenom} {item.invitations?.students?.nom}
                      </span>
                      {statusBadge(item.statut)}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.contenu}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{new Date(item.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
                      {item.tentative_envoi_le && (
                        <span>• {t('sentAt')}: {new Date(item.tentative_envoi_le).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
                      )}
                      {item.erreur && (
                        <span className="text-[#CF181C]">• {item.erreur}</span>
                      )}
                    </div>
                  </div>
                  {canEdit && item.statut === 'echec' && (
                    <button
                      onClick={() => handleResend(item)}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-[#33A944] hover:bg-[#33A944]/10 rounded-lg transition-colors"
                      title={t('retry')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-yellow-50 rounded-xl">
        <p className="text-xs text-yellow-700">
          {t('whatsAppQueue')}: max 5 / 3 min. {lang === 'fr' ? 'Méthode non officielle — un re-scan périodique du QR WhatsApp Web peut être nécessaire.' : 'Unofficial method — periodic WhatsApp Web QR re-scan may be needed.'}
        </p>
      </div>
    </AdminLayout>
  );
}
