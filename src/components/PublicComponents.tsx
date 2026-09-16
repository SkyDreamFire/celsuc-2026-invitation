import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Calendar, Clock, MapPin, Shirt } from 'lucide-react';
import type { EventSettings } from '@/lib/types';

export function Countdown({ deadline }: { deadline: string }) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setPassed(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setPassed(false);
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (passed) {
    return (
      <div className="text-center py-8">
        <p className="text-[#CF181C] text-lg font-semibold">{t('deadlinePassed')}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-sm text-gray-500 mb-3">{t('countdownTitle')}</p>
      <div className="flex justify-center gap-4">
        {[
          { label: t('days'), value: timeLeft.days },
          { label: t('hours'), value: timeLeft.hours },
          { label: t('minutes'), value: timeLeft.minutes },
          { label: t('seconds'), value: timeLeft.seconds },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-[#33A944] to-[#2a8a38] text-white rounded-xl w-16 h-16 flex items-center justify-center text-2xl font-bold shadow-lg">
              {String(item.value).padStart(2, '0')}
            </div>
            <span className="text-xs text-gray-500 mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventInfo({ settings }: { settings: EventSettings }) {
  const { t, lang } = useLanguage();
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
        <Calendar className="w-5 h-5 text-[#33A944] flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t('date')}</p>
          <p className="font-semibold text-gray-900 capitalize">{formatDate(settings.date_evenement)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
        <Clock className="w-5 h-5 text-[#33A944] flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t('time')}</p>
          <p className="font-semibold text-gray-900">
            {settings.heure_debut}
            {settings.heure_fin ? ` — ${settings.heure_fin}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
        <MapPin className="w-5 h-5 text-[#33A944] flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t('location')}</p>
          <p className="font-semibold text-gray-900">{settings.lieu}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
        <Shirt className="w-5 h-5 text-[#33A944] flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{t('dressCode')}</p>
          <p className="font-semibold text-gray-900">{settings.dress_code}</p>
        </div>
      </div>
    </div>
  );
}

export function Program({ settings }: { settings: EventSettings }) {
  const { t, lang } = useLanguage();
  const items = lang === 'fr' ? settings.programme_fr : settings.programme_en;
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">{t('program')}</h3>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#33A944] text-white text-sm font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-gray-700 pt-0.5">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PublicHeader({ settings }: { settings: EventSettings | null }) {
  const { t } = useLanguage();
  return (
    <header className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src={settings?.logo_url || '/logo-iuc.png'}
          alt="Logo IUC"
          className="h-10 w-auto bg-white p-1 rounded-lg shadow-sm object-contain"
        />
        <span className="text-white font-bold text-lg">{settings?.nom_evenement || t('celsuc2026')}</span>
      </div>
      <LanguageSwitcher />
    </header>
  );
}
