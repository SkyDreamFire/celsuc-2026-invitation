import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { Admin, AdminRole } from '@/lib/types';
import { UserPlus, Trash2, Shield } from 'lucide-react';

export function AdminManagementPage() {
  const { t } = useLanguage();
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ nom: '', email: '', role: 'consultation' as AdminRole, password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data } = await supabase.from('admins').select('*').order('nom');
    if (data) setAdmins(data as Admin[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAdd = async () => {
    setError(null);
    if (!newAdmin.nom || !newAdmin.email || !newAdmin.password) {
      setError(t('enterCredentials'));
      return;
    }
    if (newAdmin.password.length < 6) {
      setError(t('minPassword'));
      return;
    }

    setSubmitting(true);

    // Create auth user via edge function (or direct insert)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: newAdmin.email,
      password: newAdmin.password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (signUpData.user) {
      const { error: adminError } = await supabase.from('admins').insert({
        auth_id: signUpData.user.id,
        nom: newAdmin.nom,
        email: newAdmin.email,
        role: newAdmin.role,
      });

      if (adminError) {
        setError(adminError.message);
        setSubmitting(false);
        return;
      }
    }

    setNewAdmin({ nom: '', email: '', role: 'consultation', password: '' });
    setShowAdd(false);
    setSubmitting(false);
    fetchAdmins();
  };

  const handleDelete = async (admin: Admin) => {
    if (admin.id === currentAdmin?.id) {
      alert(t('cannotDeleteSelf'));
      return;
    }
    if (admin.role === 'super_admin') {
      alert(t('cannotDeleteSuperAdmin'));
      return;
    }
    if (!confirm(t('confirmDelete'))) return;

    // Delete from admins table
    await supabase.from('admins').delete().eq('id', admin.id);
    // Note: auth user deletion would require service role (edge function)
    fetchAdmins();
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: 'bg-[#33A944]/10 text-[#33A944]',
      agent_accueil: 'bg-blue-100 text-blue-700',
      consultation: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      super_admin: t('superAdmin'),
      agent_accueil: t('agentAccueil'),
      consultation: t('consultation'),
    };
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[role] || ''}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <AdminLayout title={t('manageAdmins')}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-[#33A944] text-white rounded-xl text-sm font-semibold hover:bg-[#2a8a38] transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> {t('addAdmin')}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">{t('loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('adminName')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('adminEmail')}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('adminRole')}</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {admins.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-900">{a.nom}</span>
                          {a.id === currentAdmin?.id && <span className="text-xs text-gray-400">(You)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.email}</td>
                      <td className="px-4 py-3">{roleBadge(a.role)}</td>
                      <td className="px-4 py-3 text-right">
                        {a.role !== 'super_admin' && a.id !== currentAdmin?.id && (
                          <button
                            onClick={() => handleDelete(a)}
                            className="p-1.5 text-gray-400 hover:text-[#CF181C] hover:bg-[#CF181C]/10 rounded-lg transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4">{t('newAdmin')}</h3>
            <div className="space-y-3">
              <input type="text" placeholder={t('adminName')} value={newAdmin.nom} onChange={(e) => setNewAdmin({ ...newAdmin, nom: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <input type="email" placeholder={t('adminEmail')} value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <input type="password" placeholder={t('tempPassword')} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]" />
              <select value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as AdminRole })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]">
                <option value="consultation">{t('consultation')}</option>
                <option value="agent_accueil">{t('agentAccueil')}</option>
                <option value="super_admin">{t('superAdmin')}</option>
              </select>
            </div>
            {error && <p className="mt-3 text-sm text-[#CF181C]">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200">{t('cancel')}</button>
              <button onClick={handleAdd} disabled={submitting} className="flex-1 py-2.5 bg-[#33A944] text-white rounded-xl font-semibold text-sm hover:bg-[#2a8a38] disabled:opacity-50">{t('createAdmin')}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
