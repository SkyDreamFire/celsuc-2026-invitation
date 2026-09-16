import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/lib/types';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-full p-1">
      <Globe className="w-4 h-4 text-white/70 ml-2" />
      {(['fr', 'en'] as Language[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            lang === l
              ? 'bg-white text-[#33A944]'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
