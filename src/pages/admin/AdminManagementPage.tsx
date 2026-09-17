import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import type { Admin, AdminRole } from '@/lib/types';
import {
  UserPlus,
  Trash2,
  Shield,
  Edit2,
  Search,
  Check,
  AlertTriangle,
  Users,
  ShieldAlert,
  KeyRound,
  Calendar,
  Mail,
  User,
  X,
  Lock,
} from 'lucide-react';

export function AdminManagementPage() {
  const { t, lang } = useLanguage();
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | AdminRole>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);

  // Forms state
  const [newAdmin, setNewAdmin] = useState({
    nom: '',
    email: '',
    role: 'agent_accueil' as AdminRole,
    password: '',
  });

  const [editForm, setEditForm] = useState({
    nom: '',
    email: '',
    role: 'consultation' as AdminRole,
  });

  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('Error fetching admins:', fetchErr);
      } else if (data) {
        setAdmins(data as Admin[]);
      }
    } catch (err: any) {
      console.error('Failed to load admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Filtered list & Statistics
  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      const matchSearch =
        !search ||
        a.nom.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === 'all' || a.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [admins, search, filterRole]);

  const stats = useMemo(() => {
    return {
      total: admins.length,
      superAdmins: admins.filter((a) => a.role === 'super_admin').length,
      agents: admins.filter((a) => a.role === 'agent_accueil').length,
      consultants: admins.filter((a) => a.role === 'consultation').length,
    };
  }, [admins]);

  // Handle Add Admin
  const handleAdd = async () => {
    setError(null);
    if (!newAdmin.nom.trim() || !newAdmin.email.trim() || !newAdmin.password) {
      setError(
        lang === 'fr'
          ? 'Veuillez remplir tous les champs obligatoires (nom, email et mot de passe).'
          : 'Please fill in all required fields (name, email, and password).'
      );
      return;
    }

    if (newAdmin.password.length < 6) {
      setError(
        lang === 'fr'
          ? 'Le mot de passe doit comporter au moins 6 caractères.'
          : 'Password must be at least 6 characters long.'
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newAdmin.email.trim().toLowerCase(),
        password: newAdmin.password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (signUpData.user) {
        // 2. Insert into admins profile table
        const { error: adminError } = await supabase.from('admins').insert({
          auth_id: signUpData.user.id,
          nom: newAdmin.nom.trim(),
          email: newAdmin.email.trim().toLowerCase(),
          role: newAdmin.role,
        });

        if (adminError) {
          throw new Error(adminError.message);
        }
      }

      triggerToast(
        lang === 'fr'
          ? `L'administrateur ${newAdmin.nom} a été créé avec succès.`
          : `Admin ${newAdmin.nom} created successfully.`
      );

      setNewAdmin({ nom: '', email: '', role: 'agent_accueil', password: '' });
      setShowAddModal(false);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l’administrateur.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (adm: Admin) => {
    setEditingAdmin(adm);
    setEditForm({
      nom: adm.nom,
      email: adm.email,
      role: adm.role,
    });
    setError(null);
  };

  // Handle Update Admin
  const handleUpdate = async () => {
    if (!editingAdmin) return;
    setError(null);

    if (!editForm.nom.trim()) {
      setError(lang === 'fr' ? 'Le nom ne peut pas être vide.' : 'Name cannot be empty.');
      return;
    }

    // Protection: Prevent demoting the last super admin
    if (
      editingAdmin.role === 'super_admin' &&
      editForm.role !== 'super_admin' &&
      stats.superAdmins <= 1
    ) {
      setError(
        lang === 'fr'
          ? 'Impossible de rétrograder le dernier Super Administrateur du système.'
          : 'Cannot demote the last Super Administrator in the system.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('admins')
        .update({
          nom: editForm.nom.trim(),
          role: editForm.role,
        })
        .eq('id', editingAdmin.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      triggerToast(
        lang === 'fr'
          ? `Les informations de ${editForm.nom} ont été mises à jour.`
          : `Admin ${editForm.nom} updated successfully.`
      );

      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour de l’administrateur.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Admin
  const handleDeleteConfirm = async () => {
    if (!deletingAdmin) return;

    if (deletingAdmin.id === currentAdmin?.id) {
      setError(
        lang === 'fr'
          ? 'Vous ne pouvez pas supprimer votre propre compte.'
          : 'You cannot delete your own account.'
      );
      return;
    }

    if (deletingAdmin.role === 'super_admin' && stats.superAdmins <= 1) {
      setError(
        lang === 'fr'
          ? 'Impossible de supprimer le dernier Super Administrateur.'
          : 'Cannot delete the last Super Administrator.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: delErr } = await supabase
        .from('admins')
        .delete()
        .eq('id', deletingAdmin.id);

      if (delErr) {
        throw new Error(delErr.message);
      }

      triggerToast(
        lang === 'fr'
          ? `L'administrateur ${deletingAdmin.nom} a été supprimé.`
          : `Admin ${deletingAdmin.nom} has been deleted.`
      );

      setDeletingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleMeta = (role: string) => {
    switch (role) {
      case 'super_admin':
        return {
          label: lang === 'fr' ? 'Super Admin' : 'Super Admin',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          desc:
            lang === 'fr'
              ? 'Accès complet : gestion invités, scanner, export, paramètres, et gestion admins.'
              : 'Full access: guest management, scanner, export, settings, and admin management.',
          icon: Shield,
        };
      case 'agent_accueil':
        return {
          label: lang === 'fr' ? 'Agent d’Accueil' : 'Reception Agent',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          desc:
            lang === 'fr'
              ? 'Contrôle d’accès : scanner les QR codes, envoyer les WhatsApp et consulter les invités.'
              : 'Access control: scan QR codes, send WhatsApp messages, and view guests.',
          icon: KeyRound,
        };
      case 'consultation':
      default:
        return {
          label: lang === 'fr' ? 'Consultation' : 'View Only',
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          desc:
            lang === 'fr'
              ? 'Lecture seule : visualisation des statistiques et listes sans modification.'
              : 'Read-only: view statistics and guest lists without edit rights.',
          icon: User,
        };
    }
  };

  return (
    <AdminLayout title={t('adminManagement')}>
      <div className="space-y-6">
        {/* Toast Notification */}
        {successToast && (
          <div className="p-4 rounded-2xl bg-[#33A944] text-white font-medium flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="p-1 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && !showAddModal && !editingAdmin && !deletingAdmin && (
          <div className="p-4 rounded-2xl bg-[#CF181C]/10 border border-[#CF181C]/20 text-[#CF181C] flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setFilterRole('all')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              filterRole === 'all'
                ? 'bg-gray-900 text-white shadow-md border-gray-900'
                : 'bg-white border-gray-100 shadow-sm hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${filterRole === 'all' ? 'text-gray-300' : 'text-gray-500'}`}>
                {lang === 'fr' ? 'Total Admins' : 'Total Admins'}
              </span>
              <Users className={`w-5 h-5 ${filterRole === 'all' ? 'text-white' : 'text-gray-400'}`} />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>

          <div
            onClick={() => setFilterRole('super_admin')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              filterRole === 'super_admin'
                ? 'bg-[#33A944] text-white shadow-md border-[#33A944]'
                : 'bg-white border-gray-100 shadow-sm hover:border-[#33A944]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${filterRole === 'super_admin' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                {lang === 'fr' ? 'Super Admins' : 'Super Admins'}
              </span>
              <Shield className={`w-5 h-5 ${filterRole === 'super_admin' ? 'text-white' : 'text-[#33A944]'}`} />
            </div>
            <p className="text-2xl font-bold">{stats.superAdmins}</p>
          </div>

          <div
            onClick={() => setFilterRole('agent_accueil')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              filterRole === 'agent_accueil'
                ? 'bg-blue-600 text-white shadow-md border-blue-600'
                : 'bg-white border-gray-100 shadow-sm hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${filterRole === 'agent_accueil' ? 'text-blue-100' : 'text-blue-700'}`}>
                {lang === 'fr' ? 'Agents d’Accueil' : 'Reception Agents'}
              </span>
              <KeyRound className={`w-5 h-5 ${filterRole === 'agent_accueil' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <p className="text-2xl font-bold">{stats.agents}</p>
          </div>

          <div
            onClick={() => setFilterRole('consultation')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              filterRole === 'consultation'
                ? 'bg-purple-700 text-white shadow-md border-purple-700'
                : 'bg-white border-gray-100 shadow-sm hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${filterRole === 'consultation' ? 'text-purple-100' : 'text-purple-700'}`}>
                {lang === 'fr' ? 'Consultation' : 'View Only'}
              </span>
              <User className={`w-5 h-5 ${filterRole === 'consultation' ? 'text-white' : 'text-purple-600'}`} />
            </div>
            <p className="text-2xl font-bold">{stats.consultants}</p>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={lang === 'fr' ? 'Rechercher par nom ou email...' : 'Search by name or email...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944] transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944] font-medium"
            >
              <option value="all">{lang === 'fr' ? 'Tous les rôles' : 'All roles'}</option>
              <option value="super_admin">{lang === 'fr' ? 'Super Admins' : 'Super Admins'}</option>
              <option value="agent_accueil">{lang === 'fr' ? 'Agents d’accueil' : 'Reception Agents'}</option>
              <option value="consultation">{lang === 'fr' ? 'Consultation' : 'View Only'}</option>
            </select>

            <button
              onClick={() => {
                setError(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-[#33A944] text-white rounded-xl text-sm font-semibold hover:bg-[#2a8a38] transition-all shadow-sm flex items-center gap-2 flex-shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('addAdmin')}</span>
            </button>
          </div>
        </div>

        {/* Admins Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-8 h-8 border-3 border-[#33A944]/20 border-t-[#33A944] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">{lang === 'fr' ? 'Aucun administrateur trouvé' : 'No admins found'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? (lang === 'fr' ? 'Essayez un autre mot-clé' : 'Try another keyword') : ''}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">{t('adminName')}</th>
                    <th className="px-5 py-3.5">{t('adminEmail')}</th>
                    <th className="px-5 py-3.5">{t('adminRole')}</th>
                    <th className="px-5 py-3.5">{lang === 'fr' ? 'Créé le' : 'Created at'}</th>
                    <th className="px-5 py-3.5 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredAdmins.map((adm) => {
                    const meta = roleMeta(adm.role);
                    const RoleIcon = meta.icon;
                    const isSelf = adm.id === currentAdmin?.id;

                    return (
                      <tr key={adm.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center font-bold text-gray-700 text-sm shadow-xs">
                              {adm.nom.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{adm.nom}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-md font-semibold">
                                    {lang === 'fr' ? 'Vous' : 'You'}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 block sm:hidden">{adm.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{adm.email}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.badge}`}>
                            <RoleIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-400 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {adm.created_at
                                ? new Date(adm.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(adm)}
                              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                              title={lang === 'fr' ? 'Modifier l’administrateur' : 'Edit admin'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {!isSelf && (
                              <button
                                onClick={() => {
                                  setError(null);
                                  setDeletingAdmin(adm);
                                }}
                                className="p-2 text-gray-400 hover:text-[#CF181C] hover:bg-[#CF181C]/10 rounded-xl transition-all"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD ADMIN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#33A944]/10 text-[#33A944] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{t('newAdmin')}</h3>
                  <p className="text-xs text-gray-500">{lang === 'fr' ? 'Créer un nouvel accès administrateur' : 'Create new admin access'}</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-[#CF181C]/10 border border-[#CF181C]/20 text-[#CF181C] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">{t('adminName')} *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={newAdmin.nom}
                    onChange={(e) => setNewAdmin({ ...newAdmin, nom: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">{t('adminEmail')} *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="Ex: jean.dupont@iuc.cm"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">{t('tempPassword')} *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">{t('adminRole')} *</label>
                <div className="space-y-2.5">
                  {(['super_admin', 'agent_accueil', 'consultation'] as AdminRole[]).map((r) => {
                    const meta = roleMeta(r);
                    const isSelected = newAdmin.role === r;
                    const Icon = meta.icon;

                    return (
                      <div
                        key={r}
                        onClick={() => setNewAdmin({ ...newAdmin, role: r })}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'border-[#33A944] bg-[#33A944]/5 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                            isSelected ? 'border-[#33A944] bg-[#33A944] text-white' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900">
                            <Icon className="w-4 h-4 text-gray-600" />
                            {meta.label}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting}
                className="flex-1 py-3 bg-[#33A944] text-white rounded-xl font-semibold text-sm hover:bg-[#2a8a38] transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? t('loading') : t('createAdmin')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ADMIN */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{lang === 'fr' ? 'Modifier l’administrateur' : 'Edit Admin'}</h3>
                  <p className="text-xs text-gray-500">{editingAdmin.email}</p>
                </div>
              </div>
              <button onClick={() => setEditingAdmin(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-[#CF181C]/10 border border-[#CF181C]/20 text-[#CF181C] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">{t('adminName')} *</label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#33A944]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">{t('adminEmail')}</label>
                <input
                  type="email"
                  disabled
                  value={editForm.email}
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {lang === 'fr' ? 'L’adresse email est liée au compte d’authentification Supabase.' : 'Email is bound to the Supabase auth account.'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">{t('adminRole')} *</label>
                <div className="space-y-2.5">
                  {(['super_admin', 'agent_accueil', 'consultation'] as AdminRole[]).map((r) => {
                    const meta = roleMeta(r);
                    const isSelected = editForm.role === r;
                    const Icon = meta.icon;

                    return (
                      <div
                        key={r}
                        onClick={() => setEditForm({ ...editForm, role: r })}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'border-[#33A944] bg-[#33A944]/5 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                            isSelected ? 'border-[#33A944] bg-[#33A944] text-white' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900">
                            <Icon className="w-4 h-4 text-gray-600" />
                            {meta.label}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting}
                className="flex-1 py-3 bg-[#33A944] text-white rounded-xl font-semibold text-sm hover:bg-[#2a8a38] transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? t('loading') : (lang === 'fr' ? 'Enregistrer les modifications' : 'Save changes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 text-center">
            <div className="w-16 h-16 bg-[#CF181C]/10 text-[#CF181C] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#CF181C]/20">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="font-bold text-gray-900 text-xl mb-2">{t('confirmDelete')}</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {lang === 'fr'
                ? `Êtes-vous sûr de vouloir révoquer les accès administrateur de ${deletingAdmin.nom} (${deletingAdmin.email}) ? Cette action est irréversible.`
                : `Are you sure you want to revoke admin access for ${deletingAdmin.nom} (${deletingAdmin.email})? This action cannot be undone.`}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[#CF181C]/10 text-[#CF181C] text-xs flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="flex-1 py-3 bg-[#CF181C] text-white rounded-xl font-semibold text-sm hover:bg-[#b01418] transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{submitting ? t('loading') : t('delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
