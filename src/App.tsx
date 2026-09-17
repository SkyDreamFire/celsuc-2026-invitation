import { useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useRouter } from '@/lib/router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { AdminRole } from '@/lib/types';

// Lazy-loaded pages for fast initial page load and bundle splitting
const HomePage = lazy(() => import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const InvitationPage = lazy(() => import('@/pages/public/InvitationPage').then((m) => ({ default: m.InvitationPage })));
const QrCodePage = lazy(() => import('@/pages/public/QrCodePage').then((m) => ({ default: m.QrCodePage })));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const GuestListPage = lazy(() => import('@/pages/admin/GuestListPage').then((m) => ({ default: m.GuestListPage })));
const ImportPage = lazy(() => import('@/pages/admin/ImportPage').then((m) => ({ default: m.ImportPage })));
const WhatsAppHistoryPage = lazy(() => import('@/pages/admin/WhatsAppHistoryPage').then((m) => ({ default: m.WhatsAppHistoryPage })));
const ScannerPage = lazy(() => import('@/pages/admin/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminManagementPage = lazy(() => import('@/pages/admin/AdminManagementPage').then((m) => ({ default: m.AdminManagementPage })));
const ExportPage = lazy(() => import('@/pages/admin/ExportPage').then((m) => ({ default: m.ExportPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-xs font-medium text-gray-400 tracking-wider uppercase">CELSUC 2026</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: AdminRole[] }) {
  const { session, admin, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!loading && (!session || !admin)) {
      navigate('/admin/login');
    }
  }, [session, admin, loading, navigate]);

  if (loading) {
    return <PageLoader />;
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
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes />
          </Suspense>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;

