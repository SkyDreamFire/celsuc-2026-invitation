import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useRouter } from '@/lib/router';
import QRCodeLib from 'qrcode';
import { ArrowLeft, Download, Printer, QrCode as QrIcon } from 'lucide-react';
import type { EventSettings, Invitation, QrCode, Student } from '@/lib/types';

interface FullInvitation extends Invitation {
  students: Pick<Student, 'nom' | 'prenom' | 'langue'>;
}

export function QrCodePage({ jeton }: { jeton: string }) {
  const { t, lang, setLang } = useLanguage();
  const { navigate } = useRouter();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [invitation, setInvitation] = useState<FullInvitation | null>(null);
  const [qrCode, setQrCode] = useState<QrCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    Promise.all([
      supabase.from('event_settings').select('*').limit(1).maybeSingle(),
      supabase
        .from('invitations')
        .select('*, students(nom, prenom, langue)')
        .eq('jeton_unique', jeton)
        .maybeSingle(),
    ]).then(async ([settingsRes, invRes]) => {
      if (settingsRes.data) setSettings(settingsRes.data as EventSettings);
      if (invRes.data) {
        const inv = invRes.data as FullInvitation;
        setInvitation(inv);
        if (inv.students?.langue) setLang(inv.students.langue);

        const { data: qr } = await supabase
          .from('qr_codes')
          .select('*')
          .eq('invitation_id', inv.id)
          .maybeSingle();
        if (qr) {
          setQrCode(qr as QrCode);
          const url = await QRCodeLib.toDataURL(qr.jeton_qr_unique, {
            width: 400,
            margin: 2,
            color: { dark: '#0f1a12', light: '#ffffff' },
          });
          setQrDataUrl(url);
        }
      }
      setLoading(false);
    });
  }, [jeton, setLang]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">{t('loading')}</p>
      </div>
    );
  }

  if (!invitation || invitation.statut !== 'confirmee' || !qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <QrIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900">{t('generateQrFirst')}</p>
          <button
            onClick={() => navigate(`/invitation/${jeton}`)}
            className="mt-4 px-6 py-2 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors"
          >
            {t('backToInvitation')}
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${invitation.students.prenom}_${invitation.students.nom}_CELSUC2026.png`;
    link.click();
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoSrc = settings?.logo_url || window.location.origin + '/logo-iuc.png';
    win.document.write(`
      <html><head><title>QR Code Pass - CELSUC 2026</title></head>
      <body style="text-align:center; padding:40px; font-family:Arial,sans-serif; background-color:#ffffff;">
        <div style="max-width:400px; margin:0 auto; border:2px solid #33A944; border-radius:16px; padding:24px;">
          <img src="${logoSrc}" width="80" style="margin-bottom:12px;" />
          <h2 style="color:#33A944; margin:4px 0;">CELSUC 2026</h2>
          <p style="color:#666; font-size:13px; margin:0 0 16px 0;">IUC Campus de Dschang — Soirée des Lauréats</p>
          <h3 style="margin:8px 0; color:#111;">${invitation.students.prenom} ${invitation.students.nom}</h3>
          <img src="${qrDataUrl}" width="240" style="margin:16px auto; display:block;" />
          <p style="font-size:12px; color:#555; font-weight:bold;">${t('qrInstructions')}</p>
          <p style="font-size:11px; color:#999; margin-top:8px;">Dress code: Black and White</p>
        </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/invitation/${jeton}`)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={settings?.logo_url || '/logo-iuc.png'}
            alt="Logo IUC"
            className="h-9 w-auto object-contain bg-white p-1 rounded-md shadow-xs"
          />
          <span className="font-bold text-gray-900">{t('yourQrCode')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-[#0f1a12] to-[#1a3d22] p-6 text-center">
            <img
              src={settings?.logo_url || '/logo-iuc.png'}
              alt="Logo IUC"
              className="h-16 w-auto mx-auto object-contain bg-white p-1.5 rounded-xl shadow-md mb-3"
            />
            <h1 className="text-2xl font-bold text-white">{settings?.nom_evenement || 'CELSUC 2026'}</h1>
            <p className="text-white/60 text-xs mt-1 uppercase tracking-wider">{t('qrCode')} • Pass d'accès</p>
          </div>

          <div className="p-8 text-center">
            <p className="text-lg font-semibold text-gray-900 mb-1">
              {invitation.students.prenom} {invitation.students.nom}
            </p>

            <div className="my-6 flex justify-center">
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-sm">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-gray-300">
                    <QrIcon className="w-16 h-16" />
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{t('qrInstructions')}</p>

            {qrCode.scanne && (
              <div className="mb-6 p-3 bg-[#33A944]/10 rounded-xl">
                <p className="text-sm text-[#33A944] font-semibold">
                  {t('scannedOn')}: {new Date(qrCode.scanne_le || '').toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('downloadQr')}
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> {t('printQr')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
