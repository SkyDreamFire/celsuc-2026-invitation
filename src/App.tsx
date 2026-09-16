import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useRouter } from '@/lib/router';
import { HomePage } from '@/pages/public/HomePage';
import { InvitationPage } from '@/pages/public/InvitationPage';
import { QrCodePage } from '@/pages/public/QrCodePage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { GuestListPage } from '@/pages/admin/GuestListPage';
import { ImportPage } from '@/pages/admin/ImportPage';
import { WhatsAppHistoryPage } from '@/pages/admin/WhatsAppHistoryPage';
import { ScannerPage } from '@/pages/admin/ScannerPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { AdminManagementPage } from '@/pages/admin/AdminManagementPage';
import { ExportPage } from '@/pages/admin/ExportPage';
import type { AdminRole } from '@/lib/types';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: AdminRole[] }) {
  const { session, admin, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!loading && (!session || !admin)) {
      navigate('/admin/login');
    }
  }, [session, admin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!session || !admin) {
    return null;
  }

  if (roles && !roles.includes(admin.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Routes() {
  const { route } = useRouter();
  const { session, admin, loading } = useAuth();

  // Public routes
  if (route === '/' || route === '') return <HomePage />;

  // Invitation page
  if (route.startsWith('/invitation/')) {
    const jeton = route.replace('/invitation/', '');
    return <InvitationPage jeton={jeton} />;
  }

  // QR Code page
  if (route.startsWith('/qr/')) {
    const jeton = route.replace('/qr/', '');
    return <QrCodePage jeton={jeton} />;
  }

  // Admin login
  if (route === '/admin/login') {
    if (!loading && session && admin) {
      // Redirect to dashboard if already logged in
      window.location.hash = '/admin';
      return null;
    }
    return <AdminLoginPage />;
  }

  // Admin routes (protected)
  if (route === '/admin') {
    return (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/guests') {
    return (
      <ProtectedRoute>
        <GuestListPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/import') {
    return (
      <ProtectedRoute roles={['super_admin', 'agent_accueil']}>
        <ImportPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/whatsapp') {
    return (
      <ProtectedRoute roles={['super_admin', 'agent_accueil']}>
        <WhatsAppHistoryPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/scanner') {
    return (
      <ProtectedRoute roles={['super_admin', 'agent_accueil']}>
        <ScannerPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/export') {
    return (
      <ProtectedRoute>
        <ExportPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/settings') {
    return (
      <ProtectedRoute roles={['super_admin']}>
        <SettingsPage />
      </ProtectedRoute>
    );
  }
  if (route === '/admin/admins') {
    return (
      <ProtectedRoute roles={['super_admin']}>
        <AdminManagementPage />
      </ProtectedRoute>
    );
  }

  // Fallback
  return <HomePage />;
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
