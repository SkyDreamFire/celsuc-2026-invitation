import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { EventSettings, Language } from '@/lib/types';
import { Save, Plus, Trash2, Upload } from 'lucide-react';

export function SettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [programmeFr, setProgrammeFr] = useState<string[]>([]);
  const [programmeEn, setProgrammeEn] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('event_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettings(data as EventSettings);
        setProgrammeFr(data.programme_fr || []);
        setProgrammeEn(data.programme_en || []);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from('event_settings').update({
      nom_evenement: settings.nom_evenement,
      date_evenement: settings.date_evenement,
      heure_debut: settings.heure_debut,
      heure_fin: settings.heure_fin,
      lieu: settings.lieu,
      dress_code: settings.dress_code,
      date_limite_confirmation: settings.date_limite_confirmation,
      langue_par_defaut: settings.langue_par_defaut,
      programme_fr: programmeFr,
      programme_en: programmeEn,
      whatsapp_template_fr: settings.whatsapp_template_fr,
      whatsapp_template_en: settings.whatsapp_template_en,
      logo_url: settings.logo_url,
    }).eq('id', settings.id);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (!settings) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSettings({ ...settings, logo_url: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return <AdminLayout title={t('eventSettings')}><div className="p-8 text-center text-gray-400">{t('loading')}</div></AdminLayout>;
  }

  if (!settings) {
    return <AdminLayout title={t('eventSettings')}><div className="p-8 text-center text-gray-400">{t('noData')}</div></AdminLayout>;
  }

  const inputClass = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944] focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <AdminLayout title={t('eventSettings')}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Event info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('eventInfo')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('eventName')}</label>
              <input type="text" value={settings.nom_evenement} onChange={(e) => setSettings({ ...settings, nom_evenement: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('eventDate')}</label>
              <input type="date" value={settings.date_evenement} onChange={(e) => setSettings({ ...settings, date_evenement: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('startTime')}</label>
              <input type="text" value={settings.heure_debut} onChange={(e) => setSettings({ ...settings, heure_debut: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('endTime')}</label>
              <input type="text" value={settings.heure_fin} onChange={(e) => setSettings({ ...settings, heure_fin: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('location')}</label>
              <input type="text" value={settings.lieu} onChange={(e) => setSettings({ ...settings, lieu: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('dressCode')}</label>
              <input type="text" value={settings.dress_code} onChange={(e) => setSettings({ ...settings, dress_code: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('deadlineDate')}</label>
              <input type="datetime-local" value={settings.date_limite_confirmation.slice(0, 16)} onChange={(e) => setSettings({ ...settings, date_limite_confirmation: new Date(e.target.value).toISOString() })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('defaultLanguage')}</label>
              <select value={settings.langue_par_defaut} onChange={(e) => setSettings({ ...settings, langue_par_defaut: e.target.value as Language })} className={inputClass}>
                <option value="fr">{t('languageFr')}</option>
                <option value="en">{t('languageEn')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('logoUpload')}</h3>
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-16 w-auto rounded-lg border border-gray-200" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-gray-300 text-xs">No logo</span>
              </div>
            )}
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Upload className="w-4 h-4" /> {t('uploadLogo')}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </label>
          </div>
        </div>

        {/* Program */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('programFr')}</h3>
          <div className="space-y-2">
            {programmeFr.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={item} onChange={(e) => { const n = [...programmeFr]; n[i] = e.target.value; setProgrammeFr(n); }} className={inputClass} />
                <button onClick={() => setProgrammeFr(programmeFr.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-[#CF181C] hover:bg-[#CF181C]/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setProgrammeFr([...programmeFr, ''])} className="flex items-center gap-1 text-sm text-[#33A944] hover:underline">
              <Plus className="w-4 h-4" /> {t('addProgramItem')}
            </button>
          </div>
          <h3 className="font-semibold text-gray-900 mt-6 mb-4">{t('programEn')}</h3>
          <div className="space-y-2">
            {programmeEn.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={item} onChange={(e) => { const n = [...programmeEn]; n[i] = e.target.value; setProgrammeEn(n); }} className={inputClass} />
                <button onClick={() => setProgrammeEn(programmeEn.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-[#CF181C] hover:bg-[#CF181C]/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setProgrammeEn([...programmeEn, ''])} className="flex items-center gap-1 text-sm text-[#33A944] hover:underline">
              <Plus className="w-4 h-4" /> {t('addProgramItem')}
            </button>
          </div>
        </div>

        {/* WhatsApp templates */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('whatsappHistory')}</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('whatsappTemplateFr')}</label>
              <textarea value={settings.whatsapp_template_fr} onChange={(e) => setSettings({ ...settings, whatsapp_template_fr: e.target.value })} rows={3} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('whatsappTemplateEn')}</label>
              <textarea value={settings.whatsapp_template_en} onChange={(e) => setSettings({ ...settings, whatsapp_template_en: e.target.value })} rows={3} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#33A944] text-white rounded-xl font-semibold hover:bg-[#2a8a38] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? t('loading') : t('saveSettings')}
          </button>
          {saved && <span className="text-sm text-[#33A944] font-medium">{t('settingsSaved')}</span>}
        </div>
      </div>
    </AdminLayout>
  );
}
