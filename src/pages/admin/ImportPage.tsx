import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Upload, FileText, Download } from 'lucide-react';
import type { Language } from '@/lib/types';

export function ImportPage() {
  const { t } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    let success = 0;
    const errors: string[] = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('nom') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 3) {
        errors.push(`Line ${i + 1}: insufficient columns`);
        continue;
      }
      const [nom, prenom, telephone, langue, filiere] = cols;
      if (!nom || !prenom || !telephone) {
        errors.push(`Line ${i + 1}: missing required fields`);
        continue;
      }

      const { data: student, error: sErr } = await supabase.from('students').insert({
        nom, prenom, telephone,
        langue: (langue as Language) || 'fr',
        filiere_promotion: filiere || '',
      }).select().single();

      if (sErr || !student) {
        errors.push(`Line ${i + 1}: ${sErr?.message || 'insert failed'}`);
        continue;
      }

      const { error: iErr } = await supabase.from('invitations').insert({
        student_id: student.id,
        jeton_unique: crypto.randomUUID() + crypto.randomUUID(),
        statut: 'en_attente',
      });

      if (iErr) {
        errors.push(`Line ${i + 1}: ${iErr.message}`);
      } else {
        success++;
      }
    }

    setResult({ success, errors });
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv = 'nom,prenom,telephone,langue,filiere_promotion\nKamga,Pierre,+237 699 12 34 56,fr,Informatique 2024\nFoka,Marie,+237 677 98 76 54,en,Management 2024\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'celsuc_students_template.csv';
    link.click();
  };

  return (
    <AdminLayout title={t('importGuests')}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-2">{t('importCsv')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('csvFormat')}</p>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <label className="cursor-pointer">
              <span className="inline-block px-4 py-2 bg-[#33A944] text-white rounded-xl text-sm font-semibold hover:bg-[#2a8a38] transition-colors">
                {t('selectFile')}
              </span>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            {importing && <p className="mt-3 text-sm text-gray-500">{t('loading')}</p>}
          </div>

          <button
            onClick={downloadTemplate}
            className="mt-4 flex items-center gap-2 text-sm text-[#33A944] hover:underline"
          >
            <Download className="w-4 h-4" /> {t('downloadTemplate')}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className={`p-4 rounded-xl ${result.errors.length > 0 ? 'bg-yellow-50' : 'bg-[#33A944]/5'}`}>
              <p className="font-semibold text-gray-900">
                {result.success} {t('studentsImported')}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-[#CF181C] mb-1">{t('error')}:</p>
                  <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
