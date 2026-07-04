import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BranchProvider } from './contexts/BranchContext';
import { ToastProvider } from './contexts/ToastContext';
import { PasswordProvider } from './contexts/PasswordContext';
import { PageLoading } from './components/ui/LoadingSpinner';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardRouter from './pages/dashboard/DashboardRouter';
import PlayersPage from './pages/players/PlayersPage';
import PlayerProfile from './pages/players/PlayerProfile';
import AttendancePage from './pages/attendance/AttendancePage';
import PaymentsPage from './pages/payments/PaymentsPage';
import DebtsPage from './pages/payments/DebtsPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import CoachesPage from './pages/coaches/CoachesPage';
import GroupsPage from './pages/groups/GroupsPage';
import KitsPage from './pages/kits/KitsPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import ReportsPage from './pages/reports/ReportsPage';
import UsersPage from './pages/settings/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';
import ProfilePage from './pages/profile/ProfilePage';

function RequireAuth({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <PageLoading />;
  if (!session) return <Navigate to="/login" replace />;
  // Profile still being fetched — show loading, NOT the inactive screen
  if (profile === null) return <PageLoading />;
  if (profile.is_active === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8">
        <div className="surface-card max-w-md w-full p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-arabic">عذراً، حسابك غير نشط</h2>
          <p className="text-slate-600 font-arabic">
            تم إيقاف حسابك. يرجى التواصل مع الإدارة.
          </p>
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
            className="btn btn-secondary w-full justify-center"
          >
            تسجيل الخروج والعودة
          </button>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) {
    return <div className="p-8 text-center text-red-600 font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) return <PageLoading />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardRouter />} />
        
        {/* Players & Attendance: Owner, Admin, Coach */}
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="attendance" element={<AttendancePage />} />

        {/* Financial & Management: Owner, Admin only */}
        <Route path="payments" element={<RequireAuth roles={['owner', 'admin']}><PaymentsPage /></RequireAuth>} />
        <Route path="debts" element={<RequireAuth roles={['owner']}><DebtsPage /></RequireAuth>} />
        <Route path="coaches" element={<RequireAuth roles={['owner', 'admin']}><CoachesPage /></RequireAuth>} />
        <Route path="groups" element={<RequireAuth roles={['owner', 'admin']}><GroupsPage /></RequireAuth>} />
        <Route path="kits" element={<RequireAuth roles={['owner', 'admin']}><KitsPage /></RequireAuth>} />
        <Route path="invoices" element={<RequireAuth roles={['owner']}><InvoicesPage /></RequireAuth>} />
        <Route path="expenses" element={<RequireAuth roles={['owner']}><ExpensesPage /></RequireAuth>} />
        <Route path="reports" element={<RequireAuth roles={['owner']}><ReportsPage /></RequireAuth>} />
        
        {/* System Settings: Owner only */}
        <Route path="users" element={<RequireAuth roles={['owner']}><UsersPage /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth roles={['owner', 'admin']}><SettingsPage /></RequireAuth>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <PasswordProvider>
          <AuthProvider>
            <BranchProvider>
              <AppRoutes />
            </BranchProvider>
          </AuthProvider>
        </PasswordProvider>
      </ToastProvider>
    </Router>
  );
}
