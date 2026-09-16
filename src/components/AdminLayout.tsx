import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useRouter } from '@/lib/router';
import { LayoutDashboard, Users, MessageSquare, QrCode, Settings, Shield, LogOut, Menu, X, Download } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { AdminRole } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';

interface NavItem {
  path: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  roles: AdminRole[];
}

const navItems: NavItem[] = [
  { path: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['super_admin', 'agent_accueil', 'consultation'] },
  { path: '/admin/guests', labelKey: 'guests', icon: Users, roles: ['super_admin', 'agent_accueil', 'consultation'] },
  { path: '/admin/import', labelKey: 'importGuests', icon: Users, roles: ['super_admin', 'agent_accueil'] },
  { path: '/admin/whatsapp', labelKey: 'whatsappHistory', icon: MessageSquare, roles: ['super_admin', 'agent_accueil'] },
  { path: '/admin/scanner', labelKey: 'scanner', icon: QrCode, roles: ['super_admin', 'agent_accueil'] },
  { path: '/admin/export', labelKey: 'export', icon: Download, roles: ['super_admin', 'agent_accueil', 'consultation'] },
  { path: '/admin/settings', labelKey: 'settings', icon: Settings, roles: ['super_admin'] },
  { path: '/admin/admins', labelKey: 'adminManagement', icon: Shield, roles: ['super_admin'] },
];

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { t } = useLanguage();
  const { admin, signOut, hasRole } = useAuth();
  const { route, navigate } = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter((item) => hasRole(...item.roles));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#0f1a12] text-white z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo-iuc.png"
                alt="Logo IUC"
                className="h-9 w-auto bg-white p-1 rounded-lg object-contain shadow-sm"
              />
              <div>
                <p className="font-bold text-sm leading-tight">{t('celsucAdmin')}</p>
                <p className="text-xs text-white/50">{admin?.nom || 'Admin'}</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = route === item.path || (item.path !== '/admin' && route.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#33A944] text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-[#CF181C]/20 hover:text-[#CF181C] transition-all"
          >
            <LogOut className="w-4 h-4" />
            {t('signOut')}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">
              {admin?.email}
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              admin?.role === 'super_admin' ? 'bg-[#33A944]/10 text-[#33A944]' :
              admin?.role === 'agent_accueil' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {admin?.role === 'super_admin' ? t('superAdmin') : admin?.role === 'agent_accueil' ? t('agentAccueil') : t('consultation')}
            </span>
          </div>
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
