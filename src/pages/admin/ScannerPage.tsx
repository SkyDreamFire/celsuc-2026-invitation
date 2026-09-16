import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { QrCode as QrIcon, Camera, StopCircle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type ScanState = 'idle' | 'scanning' | 'valid' | 'already' | 'invalid';

export function ScannerPage() {
  const { t, lang } = useLanguage();
  const { admin } = useAuth();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanInfo, setScanInfo] = useState<{ name?: string; firstScan?: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';

  const startScanning = async () => {
    setScanState('scanning');
    setCameraError(null);
    setScanInfo(null);

    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await handleScan(decodedText);
        },
        () => {}
      );
    } catch {
      setCameraError(t('cameraError'));
      setScanState('idle');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanState('idle');
  };

  const handleScan = async (qrToken: string) => {
    // Stop scanning while processing
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }

    // Look up QR code
    const { data: qrRaw } = await supabase
      .from('qr_codes')
      .select('id, scanne, scanne_le, invitation_id, invitations!inner(students(nom, prenom))')
      .eq('jeton_qr_unique', qrToken)
      .maybeSingle();

    const qr = qrRaw as any;

    if (!qr) {
      setScanState('invalid');
      setScanInfo(null);
      // Log scan
      if (admin) {
        const { data: adminRec } = await supabase.from('admins').select('id').eq('auth_id', admin.auth_id).maybeSingle();
        if (adminRec) {
          await supabase.from('scan_logs').insert({ qr_code_id: null, admin_id: adminRec.id, resultat: 'invalide' });
        }
      }
      return;
    }

    if (qr.scanne) {
      setScanState('already');
      setScanInfo({
        name: `${qr.invitations.students.prenom} ${qr.invitations.students.nom}`,
        firstScan: qr.scanne_le || '',
      });
      // Log scan
      if (admin) {
        const { data: adminRec } = await supabase.from('admins').select('id').eq('auth_id', admin.auth_id).maybeSingle();
        if (adminRec) {
          await supabase.from('scan_logs').insert({ qr_code_id: qr.id, admin_id: adminRec.id, resultat: 'deja_scanne' });
        }
      }
      return;
    }

    // First scan - mark as scanned
    let adminId: string | null = null;
    if (admin) {
      const { data: adminRec } = await supabase.from('admins').select('id').eq('auth_id', admin.auth_id).maybeSingle();
      adminId = adminRec?.id || null;
    }

    await supabase
      .from('qr_codes')
      .update({ scanne: true, scanne_le: new Date().toISOString(), scanne_par: adminId })
      .eq('id', qr.id);

    await supabase.from('scan_logs').insert({
      qr_code_id: qr.id,
      admin_id: adminId,
      resultat: 'valide_premier_scan',
    });

    setScanState('valid');
    setScanInfo({ name: `${qr.invitations.students.prenom} ${qr.invitations.students.nom}` });
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().then(() => scannerRef.current?.clear());
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <AdminLayout title={t('scanner')}>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Scanner */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {scanState === 'idle' || scanState === 'scanning' ? (
            <>
              <div id={containerId} className="w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-gray-900" />
              {cameraError && (
                <div className="mt-4 p-3 bg-[#CF181C]/10 text-[#CF181C] text-sm rounded-xl text-center">
                  <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                  {cameraError}
                </div>
              )}
              <div className="mt-4 text-center">
                {scanState === 'idle' ? (
                  <button
                    onClick={startScanning}
                    className="px-6 py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors inline-flex items-center gap-2"
                  >
                    <Camera className="w-5 h-5" /> {t('startScanning')}
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="px-6 py-3 bg-[#CF181C] text-white rounded-xl font-semibold hover:bg-[#a01418] transition-colors inline-flex items-center gap-2"
                  >
                    <StopCircle className="w-5 h-5" /> {t('stopScanning')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              {scanState === 'valid' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-[#33A944]/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-12 h-12 text-[#33A944]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#33A944] mb-1">{t('scanValid')}</h3>
                  {scanInfo?.name && <p className="text-gray-900 font-semibold">{scanInfo.name}</p>}
                </>
              )}
              {scanState === 'already' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-12 h-12 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-yellow-600 mb-1">{t('scanAlreadyUsed')}</h3>
                  {scanInfo?.name && <p className="text-gray-900 font-semibold">{scanInfo.name}</p>}
                  {scanInfo?.firstScan && (
                    <p className="text-sm text-gray-500 mt-1">
                      {t('firstScanTime')}: {new Date(scanInfo.firstScan).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                    </p>
                  )}
                </>
              )}
              {scanState === 'invalid' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-[#CF181C]/10 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-12 h-12 text-[#CF181C]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#CF181C]">{t('scanInvalid')}</h3>
                </>
              )}
              <button
                onClick={() => setScanState('idle')}
                className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                {t('startScanning')}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
