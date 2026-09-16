import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Countdown, EventInfo, Program } from '@/components/PublicComponents';
import { useRouter } from '@/lib/router';
import type { EventSettings } from '@/lib/types';
import { Calendar, Clock, MapPin, Shirt, Sparkles, Award, Users } from 'lucide-react';

export function HomePage() {
  const { t, lang } = useLanguage();
  const { navigate } = useRouter();
  const [settings, setSettings] = useState<EventSettings | null>(null);

  useEffect(() => {
    supabase.from('event_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as EventSettings);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative min-h-[600px] bg-gradient-to-br from-[#0f1a12] via-[#1a3d22] to-[#0f1a12] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-[#33A944] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#CF181C] rounded-full blur-3xl" />
        </div>

        <header className="relative z-10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={settings?.logo_url || '/logo-iuc.png'}
              alt="Logo IUC"
              className="h-11 w-auto bg-white p-1 rounded-lg shadow-sm object-contain"
            />
            <span className="text-white font-bold text-lg">{settings?.nom_evenement || t('celsuc2026')}</span>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-12 pb-24 text-center">
          <div className="mb-4">
            <img
              src={settings?.logo_url || '/logo-iuc.png'}
              alt="Institut Universitaire de la Côte"
              className="h-24 w-auto bg-white p-2 rounded-2xl shadow-xl mx-auto object-contain ring-2 ring-white/20"
            />
          </div>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-[#33A944]" />
            <span className="text-white/80 text-sm font-medium">{t('eveningOfLaureates')}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
            CELSUC <span className="text-[#33A944]">2026</span>
          </h1>

          <p className="text-white/60 text-lg max-w-xl mb-8">
            {lang === 'fr'
              ? 'Célébration des lauréats de l\'IUC Campus de Dschang — une soirée inoubliable de prestige, culture et convivialité.'
              : 'Celebrating the laureates of IUC Campus of Dschang — an unforgettable evening of prestige, culture and conviviality.'}
          </p>

          {settings && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-white/80 text-sm mb-12">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {new Date(settings.date_evenement).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {settings.heure_debut}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {settings.lieu}
              </span>
              <span className="flex items-center gap-1.5">
                <Shirt className="w-4 h-4" /> {settings.dress_code}
              </span>
            </div>
          )}

          {settings && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-8 py-6 max-w-2xl">
              <Countdown deadline={settings.date_limite_confirmation} />
            </div>
          )}
        </div>
      </div>

      {/* Event Info */}
      {settings && (
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('eventInfo')}</h2>
            <div className="w-16 h-1 bg-[#33A944] mx-auto rounded-full" />
          </div>
          <EventInfo settings={settings} />
        </div>
      )}

      {/* Program */}
      {settings && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <Program settings={settings} />
        </div>
      )}

      {/* Highlights */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Award, title: lang === 'fr' ? 'Distinctions' : 'Awards', desc: lang === 'fr' ? 'Remise des distinctions aux lauréats méritants' : 'Award ceremony for deserving laureates' },
              { icon: Users, title: lang === 'fr' ? 'Convivialité' : 'Conviviality', desc: lang === 'fr' ? 'Repas et moment de partage entre lauréats' : 'Dinner and sharing moment between laureates' },
              { icon: Sparkles, title: lang === 'fr' ? 'Culture' : 'Culture', desc: lang === 'fr' ? 'Prestations culturelles : danse, musique, sketchs' : 'Cultural performances: dance, music, sketches' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#33A944]/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#33A944]" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0f1a12] text-white/60 py-8 text-center">
        <p className="text-sm">{t('poweredBy')}</p>
        <button
          onClick={() => navigate('/admin/login')}
          className="mt-4 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          {t('adminLogin')}
        </button>
      </footer>
    </div>
  );
}
