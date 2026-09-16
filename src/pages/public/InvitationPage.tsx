import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Countdown, EventInfo, Program } from '@/components/PublicComponents';
import { useRouter } from '@/lib/router';
import type { EventSettings, InvitationWithStudent } from '@/lib/types';
import {
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  QrCode,
  Clock,
  Loader2,
  ExternalLink,
  Sparkles,
  Maximize2,
} from 'lucide-react';

interface RpcResponse {
  success: boolean;
  code?: string;
  message?: string;
  statut?: 'confirmee' | 'refusee';
  qr_token?: string;
}

function generateSafeToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
  }
  return (
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
}

export function InvitationPage({ jeton }: { jeton: string }) {
  const { t, lang, setLang } = useLanguage();
  const { navigate } = useRouter();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [invitation, setInvitation] = useState<InvitationWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [response, setResponse] = useState<'confirmee' | 'refusee' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [settingsRes, invRes] = await Promise.all([
          supabase.from('event_settings').select('*').limit(1).maybeSingle(),
          supabase
            .from('invitations')
            .select('*, students(nom, prenom, telephone, langue, filiere_promotion)')
            .eq('jeton_unique', jeton)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (settingsRes.data) {
          setSettings(settingsRes.data as EventSettings);
        }

        if (invRes.data) {
          const invData = invRes.data as InvitationWithStudent;
          setInvitation(invData);
          if (
            invData.students?.langue &&
            (invData.students.langue === 'fr' || invData.students.langue === 'en') &&
            invData.students.langue !== lang
          ) {
            setLang(invData.students.langue);
          }
        }
      } catch (err: any) {
        console.error('Error fetching invitation data:', err);
        if (isMounted) setError(err.message || 'Erreur lors du chargement de l’invitation.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current as any);
      }
    };
  }, [jeton, lang, setLang]);

  const deadlineString =
    invitation?.date_limite_confirmation || settings?.date_limite_confirmation;
  const deadlineDate = deadlineString ? new Date(deadlineString) : null;
  const deadlinePassed = deadlineDate ? deadlineDate.getTime() < Date.now() : false;
  const alreadyResponded = invitation ? invitation.statut !== 'en_attente' : false;

  const maskPhone = (phone?: string) => {
    if (!phone) return '';
    const clean = phone.trim();
    if (clean.length <= 4) return clean;
    return clean.slice(0, -4) + '** **';
  };

  const handleResponse = async (statut: 'confirmee' | 'refusee') => {
    if (!invitation || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Appel de la RPC sécurisée côté serveur (SECURITY DEFINER)
      const { data: rpcRaw, error: rpcError } = await supabase.rpc('repondre_invitation', {
        p_jeton: jeton,
        p_statut: statut,
      });

      const rpcResult = rpcRaw as RpcResponse | null;

      if (rpcError) {
        // Fallback direct sur Supabase si la RPC n'est pas encore appliquée en base
        console.warn('RPC unavailable, executing fallback update:', rpcError.message);

        const { error: updateError } = await supabase
          .from('invitations')
          .update({
            statut,
            date_reponse: new Date().toISOString(),
          })
          .eq('id', invitation.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (statut === 'confirmee') {
          // Création ou récupération sécurisée du QR Code avec upsert
          const randomQrToken = generateSafeToken();
          const { error: qrError } = await supabase.from('qr_codes').upsert(
            {
              invitation_id: invitation.id,
              jeton_qr_unique: randomQrToken,
            },
            { onConflict: 'invitation_id' }
          );

          if (qrError && !qrError.message.includes('duplicate')) {
            console.warn('QR Code insert note:', qrError.message);
          }
        }
      } else if (rpcResult && !rpcResult.success) {
        throw new Error(rpcResult.message || 'Impossible d’enregistrer votre réponse.');
      }

      // Mise à jour de l'état local
      const updatedDate = new Date().toISOString();
      setInvitation({
        ...invitation,
        statut,
        date_reponse: updatedDate,
      });
      setResponse(statut);
      setShowConfirm(false);

      if (statut === 'confirmee') {
        setSuccessToast(
          lang === 'fr'
            ? 'Présence confirmée avec succès ! Redirection vers votre pass...'
            : 'Attendance confirmed! Redirecting to your pass...'
        );
        redirectTimerRef.current = setTimeout(() => {
          navigate(`/qr/${invitation.jeton_unique}`);
        }, 1200);
      } else {
        setSuccessToast(
          lang === 'fr'
            ? 'Votre réponse a été enregistrée.'
            : 'Your response has been recorded.'
        );
      }
    } catch (err: any) {
      console.error('Confirmation error:', err);
      setError(
        err.message ||
          'Une erreur est survenue lors de l’enregistrement de votre réponse.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Loader2 className="w-10 h-10 text-[#33A944] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
          <div className="w-16 h-16 bg-[#CF181C]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-[#CF181C]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('invitationNotFound')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {lang === 'fr'
              ? 'Le lien d’invitation est invalide ou a été modifié. Si vous pensez qu’il s’agit d’une erreur, contactez le comité d’organisation.'
              : 'The invitation link is invalid or modified. Please contact the organizing committee if you believe this is an error.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            {t('home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            title={t('back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={settings?.logo_url || '/logo-iuc.png'}
            alt="Logo IUC"
            className="h-9 w-auto object-contain bg-white p-1 rounded-md shadow-sm"
          />
          <span className="font-bold text-gray-900 truncate">
            {settings?.nom_evenement || t('celsuc2026')}
          </span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Toast Notification */}
        {successToast && (
          <div className="mb-6 p-4 rounded-2xl bg-[#33A944] text-white font-medium flex items-center gap-3 shadow-lg animate-fade-in">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-[#CF181C]/10 border border-[#CF181C]/20 text-[#CF181C] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-[#CF181C] hover:opacity-80 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Invitation Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6 border border-gray-100">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-[#0f1a12] via-[#1a3d22] to-[#0f1a12] p-8 text-center relative">
            <div className="mb-4">
              <img
                src={settings?.logo_url || '/logo-iuc.png'}
                alt="Logo IUC"
                className="h-16 w-auto mx-auto object-contain bg-white p-2 rounded-2xl shadow-md"
              />
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3.5 py-1 mb-4">
              <ShieldCheck className="w-4 h-4 text-[#33A944]" />
              <span className="text-white/90 text-xs font-medium uppercase tracking-wider">
                {t('yourInvitation')}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {invitation.students?.prenom} {invitation.students?.nom}
            </h1>
            {invitation.students?.telephone && (
              <p className="text-white/60 text-sm">
                {t('phoneMasked')}: {maskPhone(invitation.students.telephone)}
              </p>
            )}
            {invitation.students?.filiere_promotion && (
              <span className="inline-block mt-2 px-3 py-0.5 bg-white/10 rounded-full text-white/80 text-xs font-medium">
                {invitation.students.filiere_promotion}
              </span>
            )}
          </div>

          <div className="p-6">
            {/* Status Section */}
            {alreadyResponded && (
              <div
                className={`mb-6 p-5 rounded-2xl text-center border ${
                  invitation.statut === 'confirmee'
                    ? 'bg-[#33A944]/10 border-[#33A944]/20 text-[#33A944]'
                    : invitation.statut === 'refusee'
                    ? 'bg-[#CF181C]/10 border-[#CF181C]/20 text-[#CF181C]'
                    : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}
              >
                {invitation.statut === 'confirmee' && (
                  <div className="flex items-center justify-center gap-2 font-bold text-lg">
                    <Check className="w-6 h-6" /> {t('invitationConfirmed')}
                  </div>
                )}
                {invitation.statut === 'refusee' && (
                  <div className="flex items-center justify-center gap-2 font-bold text-lg">
                    <X className="w-6 h-6" /> {t('invitationRefused')}
                  </div>
                )}
                {invitation.statut === 'expiree' && (
                  <div className="flex items-center justify-center gap-2 font-bold text-lg text-gray-700">
                    <Clock className="w-6 h-6" /> {t('invitationExpired')}
                  </div>
                )}
                <p className="text-xs mt-2 opacity-80">{t('invitationAlreadyResponded')}</p>
                {invitation.date_reponse && (
                  <p className="text-xs mt-1 opacity-70">
                    {lang === 'fr' ? 'Enregistré le : ' : 'Recorded on: '}
                    {new Date(invitation.date_reponse).toLocaleString(
                      lang === 'fr' ? 'fr-FR' : 'en-US'
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Deadline passed banner */}
            {deadlinePassed && !alreadyResponded && (
              <div className="mb-6 p-5 rounded-2xl bg-[#CF181C]/10 border border-[#CF181C]/20 text-[#CF181C] text-center">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                <p className="font-bold text-base">{t('deadlinePassed')}</p>
                <p className="text-xs mt-1 opacity-80">
                  {lang === 'fr'
                    ? 'La date limite fixée pour confirmer ou décliner l’invitation est écoulée.'
                    : 'The deadline to confirm or decline this invitation has expired.'}
                </p>
              </div>
            )}

            {/* Direct Access to QR Pass if Confirmed */}
            {invitation.statut === 'confirmee' && (
              <div className="mb-6 p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-6 h-6 text-[#33A944]" />
                    <span className="font-bold">{t('yourQrCode')}</span>
                  </div>
                  <span className="text-xs bg-[#33A944] text-white px-2.5 py-1 rounded-full font-semibold">
                    {lang === 'fr' ? 'Valide' : 'Valid'}
                  </span>
                </div>
                <p className="text-white/70 text-xs mb-4">
                  {t('qrInstructions')}
                </p>
                <button
                  onClick={() => navigate(`/qr/${invitation.jeton_unique}`)}
                  className="w-full py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <QrCode className="w-5 h-5" />
                  {lang === 'fr' ? 'Afficher mon pass QR Code' : 'Display my QR Code pass'}
                  <ExternalLink className="w-4 h-4 ml-1" />
                </button>
              </div>
            )}

            {/* Official Event Poster / Affiche Officielle */}
            <div className="mb-6">
              <div className="relative group overflow-hidden rounded-2xl border border-gray-200/90 bg-gradient-to-b from-gray-900 to-gray-950 shadow-md">
                <img
                  src="/affiche-celsuc-2026.jpg"
                  alt="Affiche Officielle CELSUC 2026 - Soirée des Lauréats"
                  className="w-full h-auto max-h-[420px] object-cover sm:object-contain mx-auto cursor-pointer transition-transform duration-300 group-hover:scale-[1.01]"
                  onClick={() => setShowPosterModal(true)}
                />
                <div className="absolute top-3 right-3">
                  <span className="bg-black/75 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm border border-white/10">
                    <Sparkles className="w-3.5 h-3.5 text-[#33A944]" />
                    {lang === 'fr' ? 'Affiche Officielle' : 'Official Poster'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPosterModal(true)}
                  className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-gray-900 text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#33A944]" />
                  {lang === 'fr' ? 'Agrandir l’affiche' : 'Enlarge poster'}
                </button>
              </div>
            </div>

            {/* Countdown before deadline if pending */}
            {!alreadyResponded && !deadlinePassed && deadlineString && (
              <div className="mb-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <Countdown deadline={deadlineString} />
              </div>
            )}

            {/* Event Info Component */}
            {settings && (
              <div className="mb-6">
                <EventInfo settings={settings} />
              </div>
            )}

            {/* Program Component */}
            {settings && (
              <div className="mb-6">
                <Program settings={settings} />
              </div>
            )}

            {/* Action Buttons if Pending and Before Deadline */}
            {!alreadyResponded && !deadlinePassed && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    setResponse('confirmee');
                    setShowConfirm(true);
                  }}
                  className="w-full py-4 bg-[#33A944] text-white rounded-xl font-bold hover:bg-[#2a8a38] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 text-base"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  {t('confirmPresence')}
                </button>

                <button
                  onClick={() => {
                    setResponse('refusee');
                    setShowConfirm(true);
                  }}
                  className="w-full py-3.5 bg-white text-[#CF181C] border-2 border-[#CF181C]/20 rounded-xl font-semibold hover:bg-[#CF181C]/5 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  {t('declineInvitation')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal with Strict Warning */}
      {showConfirm && response && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  response === 'confirmee' ? 'bg-[#33A944]/10 text-[#33A944]' : 'bg-[#CF181C]/10 text-[#CF181C]'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('confirmTitle')}</h3>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {response === 'confirmee'
                    ? (lang === 'fr'
                        ? 'Votre confirmation est définitive. Une fois validée, un QR Code individuel d’accès sera généré à votre nom.'
                        : 'Your confirmation is final. Once confirmed, an individual QR Code pass will be generated in your name.')
                    : (lang === 'fr'
                        ? 'Votre refus est définitif. Vous ne pourrez plus réclamer de QR Code pour cette soirée.'
                        : 'Your refusal is final. You will not be able to claim a QR Code for this event.')}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl text-xs text-gray-500 mb-6">
              {t('confirmWarning')}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleResponse(response)}
                disabled={submitting}
                className={`flex-1 py-3 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  response === 'confirmee'
                    ? 'bg-[#33A944] hover:bg-[#2a8a38] shadow-md'
                    : 'bg-[#CF181C] hover:bg-[#a01418] shadow-md'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('loading')}</span>
                  </>
                ) : (
                  t('validate')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poster Lightbox Modal (Plein écran) */}
      {showPosterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPosterModal(false)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center text-white mb-3 px-1">
              <span className="font-semibold text-sm sm:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#33A944]" />
                CELSUC 2026 — {lang === 'fr' ? 'Affiche Officielle' : 'Official Poster'}
              </span>
              <button
                onClick={() => setShowPosterModal(false)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                title={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src="/affiche-celsuc-2026.jpg"
              alt="Affiche Officielle CELSUC 2026"
              className="w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
