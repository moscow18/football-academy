import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import { Users, Calendar, ClipboardCheck } from 'lucide-react';

export default function CoachDashboard() {
  const { profile } = useAuth();
  const [sessionsCount, setSessionsCount] = useState(0);
  const [activePlayers, setActivePlayers] = useState(0);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.branch_id) {
      loadData();
    }
  }, [profile]);

  async function loadData() {
    setLoading(true);

    // Get groups assigned to this branch
    const { data: groups } = await supabase.from('groups').select('id').eq('branch_id', profile!.branch_id);
    const groupIds = (groups || []).map(g => g.id);

    if (groupIds.length > 0) {
      // Get active players count
      const { count: pCount } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .in('group_id', groupIds)
        .eq('status', 'active');
      setActivePlayers(pCount || 0);

      // Get sessions count (unique dates in attendance for this branch)
      const { data: attData } = await supabase
        .from('attendance')
        .select('session_date')
        .eq('branch_id', profile!.branch_id)
        .order('session_date', { ascending: false });

      const uniqueDates = new Set((attData || []).map(a => a.session_date));
      setSessionsCount(uniqueDates.size);

      // Get recent attendance records recorded by this coach
      const { data: recentAtt } = await supabase
        .from('attendance')
        .select('*, players(full_name)')
        .eq('recorded_by', profile!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentAttendance(recentAtt || []);
    }
    
    setLoading(false);
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-l from-emerald-700 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2">مرحباً كابتن {profile?.full_name?.split(' ')[0] || ''}</h2>
        <p className="text-emerald-100">نتمنى لك يوم تدريب موفق في فرع {profile?.branch_id ? 'الأكاديمية' : '...'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border-r-4 border-blue-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
              <Users size={24} />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-800 tabular-nums">{activePlayers}</div>
              <div className="text-sm text-slate-500 font-medium">لاعب نشط في الفرع</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border-r-4 border-amber-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
              <Calendar size={24} />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-800 tabular-nums">{sessionsCount}</div>
              <div className="text-sm text-slate-500 font-medium">حصة تدريبية مسجلة</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-4">أحدث تسجيلات الحضور الخاصة بك</h3>
        {recentAttendance.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={48} className="text-slate-300 mb-4" />} title="لم تقم بتسجيل حضور بعد" />
        ) : (
          <div className="space-y-3">
            {recentAttendance.map(att => (
              <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-semibold text-sm">{att.players?.full_name}</div>
                  <div className="text-xs text-slate-500">{formatDate(att.session_date)}</div>
                </div>
                <div className={`px-2.5 py-1 rounded text-xs font-bold ${
                  att.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  att.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {att.status === 'present' ? '✅ حاضر' : att.status === 'late' ? '⏰ متأخر' : '❌ غائب'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
