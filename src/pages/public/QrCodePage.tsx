import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useRouter } from '@/lib/router';
import QRCodeLib from 'qrcode';
import { ArrowLeft, Download, Printer, QrCode as QrIcon, AlertCircle, Loader2 } from 'lucide-react';
import type { EventSettings, Invitation, QrCode } from '@/lib/types';

interface StudentData {
  nom?: string;
  prenom?: string;
  langue?: 'fr' | 'en';
}

interface FullInvitation extends Invitation {
  students?: StudentData | StudentData[];
}

async function generateQrDataUrl(token: string): Promise<string> {
  try {
    const fn = (QRCodeLib as any)?.toDataURL || (QRCodeLib as any)?.default?.toDataURL;
    if (typeof fn === 'function') {
      return await fn(token, {
        width: 400,
        margin: 2,
        color: { dark: '#0f1a12', light: '#ffffff' },
      });
    }
  } catch (err) {
    console.warn('QRCodeLib canvas generation error, using fallback image service:', err);
  }

  // Fallback direct via QR generator service
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(token)}`;
}

export function QrCodePage({ jeton }: { jeton: string }) {
  const { t, lang, setLang } = useLanguage();
  const { navigate } = useRouter();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [invitation, setInvitation] = useState<FullInvitation | null>(null);
  const [qrCode, setQrCode] = useState<QrCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQrData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [settingsRes, invRes] = await Promise.all([
          supabase.from('event_settings').select('*').limit(1).maybeSingle(),
          supabase
            .from('invitations')
            .select('*, students(nom, prenom, langue)')
            .eq('jeton_unique', jeton)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (settingsRes.data) {
          setSettings(settingsRes.data as EventSettings);
        }

        if (invRes.data) {
          const inv = invRes.data as FullInvitation;
          setInvitation(inv);

          // Language sync
          const studentObj = Array.isArray(inv.students) ? inv.students[0] : inv.students;
          if (studentObj?.langue && (studentObj.langue === 'fr' || studentObj.langue === 'en')) {
            setLang(studentObj.langue);
          }

          if (inv.statut === 'confirmee') {
            let { data: qr } = await supabase
              .from('qr_codes')
              .select('*')
              .eq('invitation_id', inv.id)
              .maybeSingle();

            // Auto-création sécurisée si non existant
            if (!qr) {
              const randomQrToken =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
                  : Math.random().toString(36).substring(2) + Date.now().toString(36);

              const { data: newQr } = await supabase
                .from('qr_codes')
                .upsert(
                  { invitation_id: inv.id, jeton_qr_unique: randomQrToken },
                  { onConflict: 'invitation_id' }
                )
                .select('*')
                .maybeSingle();

              qr = newQr || {
                id: 'temp-' + inv.id,
                invitation_id: inv.id,
                jeton_qr_unique: randomQrToken,
                scanne: false,
                genere_le: new Date().toISOString(),
              };
            }

            if (qr) {
              setQrCode(qr as QrCode);
              const dataUrl = await generateQrDataUrl(qr.jeton_qr_unique || inv.jeton_unique);
              if (isMounted) setQrDataUrl(dataUrl);
            }
          }
        }
      } catch (err: any) {
        console.error('Error in QrCodePage:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Impossible de charger le QR Code.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadQrData();

    return () => {
      isMounted = false;
    };
  }, [jeton, setLang]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Loader2 className="w-10 h-10 text-[#33A944] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">{t('loading')}</p>
      </div>
    );
  }

  // Safe student extraction
  const student = Array.isArray(invitation?.students) ? invitation?.students[0] : invitation?.students;
  const studentPrenom = student?.prenom || '';
  const studentNom = student?.nom || '';
  const studentFullName = `${studentPrenom} ${studentNom}`.trim() || 'Invité(e)';

  if (!invitation || invitation.statut !== 'confirmee' || !qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
          <div className="w-16 h-16 bg-[#33A944]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrIcon className="w-8 h-8 text-[#33A944]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('generateQrFirst')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {lang === 'fr'
              ? 'Vous devez d’abord confirmer votre présence pour obtenir votre pass d’accès QR Code.'
              : 'You must confirm your attendance first to obtain your QR Code access pass.'}
          </p>
          <button
            onClick={() => navigate(`/invitation/${jeton}`)}
            className="w-full py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors shadow-sm"
          >
            {t('backToInvitation')}
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${studentPrenom || 'Pass'}_${studentNom || 'CELSUC'}_CELSUC2026.png`;
    link.click();
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoSrc = settings?.logo_url || window.location.origin + '/logo-iuc.png';
    win.document.write(`
      <!doctype html>
      <html><head><title>Pass d'accès QR Code - CELSUC 2026</title></head>
      <body style="text-align:center; padding:40px; font-family:Arial,sans-serif; background-color:#ffffff;">
        <div style="max-width:400px; margin:0 auto; border:2px solid #33A944; border-radius:16px; padding:24px;">
          <img src="${logoSrc}" width="80" style="margin-bottom:12px; object-contain:contain;" />
          <h2 style="color:#33A944; margin:4px 0;">CELSUC 2026</h2>
          <p style="color:#666; font-size:13px; margin:0 0 16px 0;">IUC Campus de Dschang — Soirée des Lauréats</p>
          <h3 style="margin:8px 0; color:#111; font-size:18px;">${studentFullName}</h3>
          <img src="${qrDataUrl}" width="240" height="240" style="margin:16px auto; display:block;" />
          <p style="font-size:12px; color:#555; font-weight:bold;">${t('qrInstructions')}</p>
          <p style="font-size:11px; color:#999; margin-top:8px;">Dress code : ${settings?.dress_code || 'Black and White'}</p>
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
          <button
            onClick={() => navigate(`/invitation/${jeton}`)}
            className="text-gray-600 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title={t('backToInvitation')}
          >
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
        {errorMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <span>{errorMessage}</span>
          </div>
        )}

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
            <p className="text-xl font-bold text-gray-900 mb-1">
              {studentFullName}
            </p>

            <div className="my-6 flex justify-center">
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-sm">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code Pass" className="w-64 h-64 object-contain" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-gray-300">
                    <QrIcon className="w-16 h-16 animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{t('qrInstructions')}</p>

            {qrCode?.scanne && (
              <div className="mb-6 p-3 bg-[#33A944]/10 rounded-xl border border-[#33A944]/20">
                <p className="text-sm text-[#33A944] font-semibold">
                  {t('scannedOn')}: {new Date(qrCode.scanne_le || '').toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors flex items-center justify-center gap-2 shadow-sm"
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
