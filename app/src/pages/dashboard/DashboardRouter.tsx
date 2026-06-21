import { useAuth } from '../../contexts/AuthContext';
import OwnerDashboard from './OwnerDashboard';
import CoachDashboard from './CoachDashboard';

export default function DashboardRouter() {
  const { profile } = useAuth();
  
  if (!profile) return null;

  if (profile.role === 'owner' || profile.role === 'admin') {
    return <OwnerDashboard />;
  }
  
  return <CoachDashboard />;
}
