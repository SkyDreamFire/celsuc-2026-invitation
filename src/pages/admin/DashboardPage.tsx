import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { EventSettings } from '@/lib/types';
import { Users, CheckCircle2, XCircle, Clock, QrCode, UserCheck, TrendingUp, Activity } from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalInvitations: number;
  confirmedCount: number;
  refusedCount: number;
  pendingCount: number;
  qrGenerated: number;
  presences: number;
  whatsappSent: number;
  whatsappFailed: number;
  whatsappPending: number;
  recentScans: { id: string; resultat: string; horodatage: string; qr_code_id: string }[];
}

export function DashboardPage() {
  const { t, lang } = useLanguage();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalInvitations: 0,
    confirmedCount: 0,
    refusedCount: 0,
    pendingCount: 0,
    qrGenerated: 0,
    presences: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    whatsappPending: 0,
    recentScans: [],
  });

  useEffect(() => {
    Promise.all([
      supabase.from('event_settings').select('*').limit(1).maybeSingle(),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('invitations').select('statut'),
      supabase.from('qr_codes').select('scanne', { count: 'exact' }),
      supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('scanne', true),
      supabase.from('whatsapp_queue').select('statut'),
      supabase.from('scan_logs').select('id, resultat, horodatage, qr_code_id').order('horodatage', { ascending: false }).limit(5),
    ]).then(async ([settingsRes, studentsRes, invRes, qrRes, scannedRes, waRes, scansRes]) => {
      if (settingsRes.data) setSettings(settingsRes.data as EventSettings);

      const invitations = invRes.data || [];
      const confirmed = invitations.filter((i: { statut: string }) => i.statut === 'confirmee').length;
      const refused = invitations.filter((i: { statut: string }) => i.statut === 'refusee').length;
      const pending = invitations.filter((i: { statut: string }) => i.statut === 'en_attente').length;

      const waItems = waRes.data || [];
      const waSent = waItems.filter((w: { statut: string }) => w.statut === 'envoye').length;
      const waFailed = waItems.filter((w: { statut: string }) => w.statut === 'echec').length;
      const waPending = waItems.filter((w: { statut: string }) => w.statut === 'en_attente').length;

      setStats({
        totalStudents: studentsRes.count || 0,
        totalInvitations: invitations.length,
        confirmedCount: confirmed,
        refusedCount: refused,
        pendingCount: pending,
        qrGenerated: qrRes.count || 0,
        presences: scannedRes.count || 0,
        whatsappSent: waSent,
        whatsappFailed: waFailed,
        whatsappPending: waPending,
        recentScans: (scansRes.data || []) as DashboardStats['recentScans'],
      });
    });
  }, []);

  const confirmationRate = stats.totalInvitations > 0
    ? Math.round((stats.confirmedCount / stats.totalInvitations) * 100)
    : 0;

  const statCards = [
    { label: t('totalStudents'), value: stats.totalStudents, icon: Users, color: '#33A944' },
    { label: t('confirmations'), value: stats.confirmedCount, icon: CheckCircle2, color: '#33A944' },
    { label: t('refusals'), value: stats.refusedCount, icon: XCircle, color: '#CF181C' },
    { label: t('noResponse'), value: stats.pendingCount, icon: Clock, color: '#C5C5CB' },
    { label: t('qrGenerated'), value: stats.qrGenerated, icon: QrCode, color: '#33A944' },
    { label: t('presences'), value: stats.presences, icon: UserCheck, color: '#33A944' },
    { label: t('invitationsDelivered'), value: stats.whatsappSent, icon: CheckCircle2, color: '#33A944' },
    { label: t('invitationsFailed'), value: stats.whatsappFailed, icon: XCircle, color: '#CF181C' },
  ];

  return (
    <AdminLayout title={t('dashboard')}>
      <div className="space-y-6">
        {/* Overview */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('overview')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation rate */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-[#33A944]" />
            <h3 className="font-semibold text-gray-900">{t('confirmationRate')}</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#33A944] to-[#2a8a38] rounded-full transition-all duration-1000"
                  style={{ width: `${confirmationRate}%` }}
                />
              </div>
            </div>
            <span className="text-2xl font-bold text-[#33A944]">{confirmationRate}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <p className="text-lg font-bold text-[#33A944]">{stats.confirmedCount}</p>
              <p className="text-xs text-gray-500">{t('confirmed')}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#CF181C]">{stats.refusedCount}</p>
              <p className="text-xs text-gray-500">{t('refused')}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-400">{stats.pendingCount}</p>
              <p className="text-xs text-gray-500">{t('pending')}</p>
            </div>
          </div>
        </div>

        {/* Recent scans */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-[#33A944]" />
            <h3 className="font-semibold text-gray-900">{t('recentScans')}</h3>
          </div>
          {stats.recentScans.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{t('noScans')}</p>
          ) : (
            <div className="space-y-2">
              {stats.recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      scan.resultat === 'valide_premier_scan' ? 'bg-[#33A944]' :
                      scan.resultat === 'deja_scanne' ? 'bg-yellow-500' : 'bg-[#CF181C]'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">
                      {scan.resultat === 'valide_premier_scan' ? t('validFirstScan') :
                       scan.resultat === 'deja_scanne' ? t('alreadyScanned') : t('invalid')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(scan.horodatage).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp queue summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('whatsAppQueue')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-600">{stats.whatsappPending}</p>
              <p className="text-xs text-gray-500">{t('pending')}</p>
            </div>
            <div className="text-center p-4 bg-[#33A944]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#33A944]">{stats.whatsappSent}</p>
              <p className="text-xs text-gray-500">{t('invitationsDelivered')}</p>
            </div>
            <div className="text-center p-4 bg-[#CF181C]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#CF181C]">{stats.whatsappFailed}</p>
              <p className="text-xs text-gray-500">{t('invitationsFailed')}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
