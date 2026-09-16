import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Download, Users, UserCheck, UserX } from 'lucide-react';

export function ExportPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('scanne', true),
    ]).then(([s, p]) => {
      setStats({
        total: s.count || 0,
        present: p.count || 0,
        absent: (s.count || 0) - (p.count || 0),
      });
    });
  }, []);

  const exportData = async (type: 'all' | 'present' | 'absent') => {
    const { data } = await supabase
      .from('students')
      .select(`
        nom, prenom, telephone, langue, filiere_promotion,
        invitations!inner(statut, date_reponse, qr_codes(scanne, scanne_le))
      `);

    if (!data) return;

    const getInvitationData = (s: any) => {
      const inv = Array.isArray(s.invitations) ? s.invitations[0] : s.invitations;
      let qrList: any[] = [];
      if (inv?.qr_codes) {
        qrList = Array.isArray(inv.qr_codes) ? inv.qr_codes : [inv.qr_codes];
      }
      const isPresent = qrList.some((q: any) => q.scanne);
      return { inv, isPresent };
    };

    let filtered = data;
    if (type === 'present') {
      filtered = data.filter((s: any) => getInvitationData(s).isPresent);
    } else if (type === 'absent') {
      filtered = data.filter((s: any) => !getInvitationData(s).isPresent);
    }

    const rows = [
      ['Nom', 'Prenom', 'Telephone', 'Langue', 'Filiere/Promotion', 'Statut', 'Present'],
      ...filtered.map((s: any) => {
        const { inv, isPresent } = getInvitationData(s);
        return [
          s.nom,
          s.prenom,
          s.telephone,
          s.langue,
          s.filiere_promotion || '',
          inv?.statut || '',
          isPresent ? 'Oui' : 'Non',
        ];
      }),
    ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `celsuc_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const cards = [
    { label: t('allGuests'), value: stats.total, icon: Users, color: '#33A944', type: 'all' as const },
    { label: t('presentGuests'), value: stats.present, icon: UserCheck, color: '#33A944', type: 'present' as const },
    { label: t('absentGuests'), value: stats.absent, icon: UserX, color: '#CF181C', type: 'absent' as const },
  ];

  return (
    <AdminLayout title={t('export')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${card.color}15` }}>
                <Icon className="w-6 h-6" style={{ color: card.color }} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mb-4">{card.label}</p>
              <button
                onClick={() => exportData(card.type)}
                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('exportCsv')}
              </button>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
