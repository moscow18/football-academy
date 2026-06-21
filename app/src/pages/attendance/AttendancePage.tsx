import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { toISODate, buildWhatsAppLink, lateArrivalMessage } from '../../lib/utils';
import { CheckCircle2, Clock, XCircle, MessageCircle, Save, Users, Calendar, ClipboardList } from 'lucide-react';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import type { Group, Player, AttendanceStatus } from '../../lib/types';

interface PlayerAttendance {
  player: Player;
  status: AttendanceStatus | null;
  existingId: string | null;
}

export default function AttendancePage() {
  const { branchFilter } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [date, setDate] = useState(toISODate());
  const [playerRows, setPlayerRows] = useState<PlayerAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    let q = supabase.from('groups').select('*');
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q.order('name');
    setGroups(data || []);
  }, [branchFilter]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadAttendance = useCallback(async () => {
    if (!selectedGroup || !date) return;
    setLoading(true);

    // Load players in this group
    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('group_id', selectedGroup)
      .eq('status', 'active')
      .order('full_name');

    // Load existing attendance for this date
    const playerIds = (playersData || []).map(p => p.id);
    let existingMap: Record<string, { id: string; status: AttendanceStatus }> = {};

    if (playerIds.length > 0) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, player_id, status')
        .eq('session_date', date)
        .in('player_id', playerIds);

      existingMap = (attData || []).reduce((acc, a) => {
        acc[a.player_id] = { id: a.id, status: a.status as AttendanceStatus };
        return acc;
      }, {} as Record<string, { id: string; status: AttendanceStatus }>);
    }

    setPlayerRows((playersData || []).map(p => ({
      player: p as Player,
      status: existingMap[p.id]?.status || null,
      existingId: existingMap[p.id]?.id || null,
    })));
    setLoading(false);
  }, [selectedGroup, date]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  function setStatus(playerIndex: number, status: AttendanceStatus) {
    setPlayerRows(prev => prev.map((row, i) =>
      i === playerIndex ? { ...row, status: row.status === status ? null : status } : row
    ));
  }

  async function saveAttendance() {
    const marked = playerRows.filter(r => r.status !== null);
    if (marked.length === 0) {
      toast('warning', 'يرجى تحديد حالة حضور لاعب واحد على الأقل');
      return;
    }

    setSaving(true);
    const group = groups.find(g => g.id === selectedGroup);

    for (const row of marked) {
      if (row.existingId) {
        // Update existing
        await supabase.from('attendance').update({
          status: row.status,
          recorded_by: profile?.id,
        }).eq('id', row.existingId);
      } else {
        // Insert new
        await supabase.from('attendance').insert({
          player_id: row.player.id,
          branch_id: group?.branch_id || branchFilter,
          session_date: date,
          status: row.status,
          recorded_by: profile?.id,
        });
      }
    }

    toast('success', `تم حفظ حضور ${marked.length} لاعب بنجاح`);
    setSaving(false);
    loadAttendance();
  }

  async function sendWhatsApp(row: PlayerAttendance) {
    const phone = row.player.parent_phone || row.player.phone;
    if (!phone) {
      toast('warning', 'لا يوجد رقم هاتف لهذا اللاعب');
      return;
    }

    const link = buildWhatsAppLink(phone, lateArrivalMessage(row.player.full_name));
    window.open(link, '_blank');

    // Log the WhatsApp send
    await supabase.from('whatsapp_log').insert({
      player_id: row.player.id,
      branch_id: row.player.branch_id,
      message_type: 'late_arrival',
      message_text: lateArrivalMessage(row.player.full_name),
      sent_by: profile?.id,
    });

    // Mark as sent in attendance
    if (row.existingId) {
      await supabase.from('attendance').update({ whatsapp_sent: true }).eq('id', row.existingId);
    }

    toast('info', 'تم فتح رابط WhatsApp');
  }

  return (
    <div className="pb-24">
      {/* Sticky Top Bar for Selection & Save */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4 -mx-6 mb-6 shadow-sm flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="form-label flex items-center gap-1.5"><Users size={14} /> المجموعة</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="input-field"
            >
              <option value="">اختر المجموعة...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="form-label flex items-center gap-1.5"><Calendar size={14} /> التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <button
          onClick={saveAttendance}
          disabled={saving || playerRows.length === 0}
          className="btn btn-primary"
        >
          <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ سجل الحضور'}
        </button>
      </div>

      {/* Attendance Content */}
      {!selectedGroup ? (
        <EmptyState icon={<ClipboardList size={48} />} title="اختر مجموعة لتسجيل الحضور" subtitle="حدد المجموعة والتاريخ من الشريط العلوي للبدء" />
      ) : loading ? (
        <PageLoading />
      ) : playerRows.length === 0 ? (
        <EmptyState 
          icon={<Users size={48} className="text-slate-300 mb-4" />} 
          title="لا يوجد لاعبين في هذه المجموعة" 
          subtitle="لتسجيل الحضور، يجب عليك أولاً الذهاب إلى (صفحة اللاعبين) وتعديل بيانات اللاعبين لربطهم بهذه المجموعة." 
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="flex flex-wrap gap-4 p-4 surface-card items-center">
            <span className="font-semibold text-slate-700 font-arabic text-sm ml-2">ملخص الحضور:</span>
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md">
              <CheckCircle2 size={16} /> حاضر: <span className="font-tabular font-bold">{playerRows.filter(r => r.status === 'present').length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-md">
              <Clock size={16} /> متأخر: <span className="font-tabular font-bold">{playerRows.filter(r => r.status === 'late').length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-red-700 bg-red-50 px-3 py-1 rounded-md">
              <XCircle size={16} /> غائب: <span className="font-tabular font-bold">{playerRows.filter(r => r.status === 'absent').length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
              غير محدد: <span className="font-tabular font-bold">{playerRows.filter(r => r.status === null).length}</span>
            </div>
          </div>

          {/* Dense Table */}
          <div className="data-table-container">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-16">الكود</th>
                    <th>اسم اللاعب</th>
                    <th className="text-center">الحالة</th>
                    <th className="w-32 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((row, idx) => (
                    <tr key={row.player.id} className={row.status === null ? 'bg-slate-50/50' : ''}>
                      <td className="font-tabular text-slate-500 text-xs">{row.player.player_code}</td>
                      <td className="font-semibold text-slate-900 font-arabic">{row.player.full_name}</td>
                      <td className="text-center">
                        <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                          <button
                            onClick={() => setStatus(idx, 'present')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-none ${row.status === 'present' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700 bg-transparent'}`}
                          >
                            <CheckCircle2 size={16} /> حاضر
                          </button>
                          <button
                            onClick={() => setStatus(idx, 'late')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-none ${row.status === 'late' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700 bg-transparent'}`}
                          >
                            <Clock size={16} /> متأخر
                          </button>
                          <button
                            onClick={() => setStatus(idx, 'absent')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-none ${row.status === 'absent' ? 'bg-white shadow-sm text-red-700' : 'text-slate-500 hover:text-slate-700 bg-transparent'}`}
                          >
                            <XCircle size={16} /> غائب
                          </button>
                        </div>
                      </td>
                      <td className="text-center">
                        {row.status === 'late' ? (
                          <button
                            onClick={() => sendWhatsApp(row)}
                            className="btn btn-secondary py-1.5 px-3 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          >
                            <MessageCircle size={14} /> تنبيه
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
