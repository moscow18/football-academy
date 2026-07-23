import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/ui/Modal';
import { formatMoney, buildWhatsAppLink, debtReminderMessage, renewalReminderMessage, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import type { DebtItem, Group } from '../../lib/types';
import { Plus, Users, Edit2, Trash2, RotateCcw } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';

const DAYS_OF_WEEK = [
  { id: 'saturday', name: 'السبت' },
  { id: 'sunday', name: 'الأحد' },
  { id: 'monday', name: 'الإثنين' },
  { id: 'tuesday', name: 'الثلاثاء' },
  { id: 'wednesday', name: 'الأربعاء' },
  { id: 'thursday', name: 'الخميس' },
  { id: 'friday', name: 'الجمعة' },
];

export default function PeriodicSubscriptionsPage() {
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();

  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<{ id: string; full_name: string; player_code: string }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [birthYearFilter, setBirthYearFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Export & Modals State
  const [isExportingPlayer, setIsExportingPlayer] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);

  // Delete state
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDeletePlayer() {
    if (!playerToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerToDelete.id);
      if (error) {
        toast('error', `حدث خطأ أثناء حذف اللاعب: ${error.message}`);
        return;
      }
      toast('success', `تم حذف اللاعب ${playerToDelete.name} بجميع بياناته بنجاح`);
      setPlayerToDelete(null);
      loadData();
    } catch (err: any) {
      toast('error', `حدث خطأ: ${err.message || 'فشل في حذف اللاعب'}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Forms State
  const [playerForm, setPlayerForm] = useState({
    full_name: '',
    branch_id: '',
    date_of_birth: '',
    birth_year: '2016',
    registration_date: new Date().toISOString().split('T')[0],
    group_id: '',
    fee_amount_periodic: '1200',
    phone: '',
    parent_phone: '',
    notes: '',
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    branch_id: '',
    coach_id: '',
    schedule_time: '16:00',
    schedule_days: [] as string[],
    selected_player_ids: [] as string[],
  });

  const loadGroups = useCallback(async () => {
    let q = supabase.from('groups').select('*');
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q.order('name');
    setGroups(data || []);
  }, [branchFilter]);

  const loadCoaches = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'coach')
      .eq('is_active', true);
    setCoaches(data?.map(c => ({ id: c.id, name: c.full_name })) || []);
  }, []);

  const loadData = useCallback(async () => {
    if (initialLoading) setLoading(true);
    const { data } = await supabase.rpc('rpc_debt_list', {
      p_branch_id: branchFilter || null,
    });
    setDebts((data as DebtItem[]) || []);
    setLoading(false);
    setInitialLoading(false);
  }, [branchFilter, initialLoading]);

  const loadAvailablePlayers = async (branchId: string) => {
    const { data } = await supabase
      .from('players')
      .select('id, full_name, player_code')
      .eq('branch_id', branchId)
      .eq('status', 'active');
    setAvailablePlayers(data || []);
  };

  useEffect(() => {
    loadData();
    loadGroups();
    loadCoaches();
  }, [branchFilter, loadGroups, loadData, loadCoaches]);

  useEffect(() => {
    if (groupForm.branch_id) {
      loadAvailablePlayers(groupForm.branch_id);
    } else {
      setAvailablePlayers([]);
    }
  }, [groupForm.branch_id]);

  // ⚡ Realtime: auto-refresh when players or payments change
  useRealtimeRefresh(['players', 'payments'], loadData);

  // Filter periodic (league) players: payment_type = 'quarterly' OR has a non-zero periodic fee
  const leaguePlayers = debts.filter(d => d.payment_type === 'quarterly' || Number(d.fee_amount_periodic) > 0);

  // Dynamically extract unique birth years
  const birthYears = Array.from(new Set(
    leaguePlayers
      .map(p => p.date_of_birth ? p.date_of_birth.substring(0, 4) : '')
      .filter(year => year !== '')
  )).sort((a, b) => b.localeCompare(a));

  // Apply filters
  const filteredData = leaguePlayers.filter(d => {
    if (searchQuery && !d.player_name.includes(searchQuery) && !d.player_code.includes(searchQuery)) return false;
    if (birthYearFilter && d.date_of_birth?.substring(0, 4) !== birthYearFilter) return false;
    if (groupFilter && d.group_name !== groupFilter) return false;
    return true;
  });

  // Calculate stats — LEAGUE ONLY (no monthly fees included)
  const totalExpectedPeriodic = filteredData.reduce((s, d) => s + Number(d.total_expected_periodic || 0), 0);
  const totalDebtPeriodic = filteredData.reduce((s, d) => s + Number(d.debt_periodic || 0), 0);
  const debtorsCount = filteredData.filter(d => Number(d.debt_periodic || 0) > 0).length;

  const filteredPlayersForGroup = availablePlayers.filter(p => 
    p.full_name.includes(playerSearchQuery) || p.player_code.includes(playerSearchQuery)
  );

  const openAddPlayerForm = () => {
    setEditingPlayer(null);
    setPlayerForm({
      full_name: '',
      branch_id: branchFilter || (branches[0]?.id || ''),
      date_of_birth: '',
      birth_year: '2016',
      registration_date: new Date().toISOString().split('T')[0],
      group_id: '',
      fee_amount_periodic: '1200',
      phone: '',
      parent_phone: '',
      notes: '',
    });
    setShowPlayerModal(true);
  };

  const handleEditPlayer = async (playerId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from('players').select('*').eq('id', playerId).single();
    setLoading(false);
    if (error || !data) {
      toast('error', 'فشل في تحميل بيانات اللاعب');
      return;
    }
    
    setPlayerForm({
      full_name: data.full_name,
      branch_id: data.branch_id,
      date_of_birth: data.date_of_birth || '',
      birth_year: data.date_of_birth ? data.date_of_birth.substring(0, 4) : '2016',
      registration_date: data.registration_date || new Date().toISOString().split('T')[0],
      group_id: data.group_id || '',
      fee_amount_periodic: data.fee_amount_periodic?.toString() || '0',
      phone: data.phone || '',
      parent_phone: data.parent_phone || '',
      notes: data.notes || '',
    });
    setEditingPlayer(data);
    setShowPlayerModal(true);
  };

  const openAddGroupForm = () => {
    const selectedBranch = branchFilter || (branches[0]?.id || '');
    setGroupForm({
      name: '',
      branch_id: selectedBranch,
      coach_id: '',
      schedule_time: '16:00',
      schedule_days: [],
      selected_player_ids: [],
    });
    setPlayerSearchQuery('');
    setShowGroupModal(true);
  };

  const toggleGroupDay = (dayId: string) => {
    setGroupForm(prev => {
      const days = prev.schedule_days.includes(dayId)
        ? prev.schedule_days.filter(d => d !== dayId)
        : [...prev.schedule_days, dayId];
      return { ...prev, schedule_days: days };
    });
  };

  async function savePlayer() {
    if (!playerForm.full_name || !playerForm.branch_id || !playerForm.fee_amount_periodic) {
      toast('error', 'يرجى ملء الحقول المطلوبة (*)');
      return;
    }
    setIsSaving(true);
    try {
      const dob = playerForm.date_of_birth || `${playerForm.birth_year}-01-01`;
      const payload = {
        full_name: playerForm.full_name,
        branch_id: playerForm.branch_id,
        date_of_birth: dob,
        registration_date: playerForm.registration_date,
        group_id: playerForm.group_id || null,
        fee_amount_periodic: Number(playerForm.fee_amount_periodic),
        payment_type: 'quarterly', // Force quarterly for league players
        phone: playerForm.phone || null,
        parent_phone: playerForm.parent_phone || null,
        notes: playerForm.notes || null,
      };

      if (editingPlayer) {
        const { error } = await supabase
          .from('players')
          .update(payload)
          .eq('id', editingPlayer.id);

        if (error) {
          toast('error', `خطأ أثناء تعديل بيانات اللاعب: ${error.message}`);
          return;
        }
        toast('success', 'تم تعديل بيانات اللاعب بنجاح');
      } else {
        const { error } = await supabase.from('players').insert({
          ...payload,
          status: 'active',
          fee_amount: 0,
        });

        if (error) {
          toast('error', `خطأ أثناء إضافة اللاعب: ${error.message}`);
          return;
        }
        toast('success', 'تم إضافة اللاعب بنجاح للدوري');
      }
      setShowPlayerModal(false);
      setEditingPlayer(null);
      loadData();
    } catch (err: any) {
      toast('error', `خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGroup() {
    if (!groupForm.name || !groupForm.branch_id) {
      toast('error', 'يرجى إدخال اسم المجموعة وتحديد الفرع');
      return;
    }
    setIsSaving(true);
    try {
      // 1. Insert group
      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name: groupForm.name,
          branch_id: groupForm.branch_id,
          coach_id: groupForm.coach_id || null,
          schedule_days: groupForm.schedule_days,
          schedule_time: groupForm.schedule_time || null,
        })
        .select()
        .single();

      if (groupErr) {
        toast('error', `خطأ أثناء إنشاء المجموعة: ${groupErr.message}`);
        return;
      }

      // 2. Assign selected players to the new group
      if (groupForm.selected_player_ids.length > 0) {
        const { error: updateErr } = await supabase
          .from('players')
          .update({ group_id: newGroup.id })
          .in('id', groupForm.selected_player_ids);

        if (updateErr) {
          toast('error', `تم إنشاء المجموعة بنجاح، ولكن حدث خطأ أثناء ضم بعض اللاعبين: ${updateErr.message}`);
          loadData();
          return;
        }
      }

      toast('success', 'تم إنشاء المجموعة وضم اللاعبين بنجاح');
      setShowGroupModal(false);
      loadData();
      loadGroups();
    } catch (err: any) {
      toast('error', `خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function exportPlayerExcel(playerId: string, player: DebtItem) {
    setIsExportingPlayer(playerId);
    try {
      const [paymentsRes, attendanceRes, kitsRes] = await Promise.all([
        supabase.from('payments').select('*').eq('player_id', playerId).order('payment_date', { ascending: false }),
        supabase.from('attendance').select('*').eq('player_id', playerId).order('session_date', { ascending: false }),
        supabase.from('kit_purchases').select('*, kit_items(item_name)').eq('player_id', playerId).order('purchase_date', { ascending: false }),
      ]);

      const payments = paymentsRes.data || [];
      const attendance = attendanceRes.data || [];
      const kits = (kitsRes.data || []).map((k: any) => ({
        ...k,
        item_name: k.kit_items?.item_name || 'طقم'
      }));

      const wb = XLSX.utils.book_new();

      // Sheet 1: Basic Info
      const infoData = [
        ['كود اللاعب', player.player_code],
        ['اسم اللاعب', player.player_name],
        ['الفرع', player.branch_name],
        ['المجموعة/الفريق', player.group_name || 'بدون مجموعة'],
        ['الهاتف', player.phone || '—'],
        ['هاتف ولي الأمر', player.parent_phone || '—'],
        ['سنة الميلاد', player.date_of_birth ? player.date_of_birth.substring(0, 4) : '—'],
        ['تاريخ التسجيل والاشتراك', player.registration_date ? formatDate(player.registration_date) : '—'],
        ['نوع الاشتراك المفضل', player.payment_type === 'quarterly' ? 'دوري' : 'شهري'],
        ['قيمة الاشتراك الدوري', player.fee_amount_periodic],
        ['عدد الأرباع المنقضية', Math.ceil(player.months_enrolled / 3)],
        ['إجمالي المتوقع (دوري)', player.total_expected_periodic],
        ['إجمالي المدفوع (شامل)', player.total_paid],
        ['مديونية الدوري الحالية', player.debt_periodic],
        ['تاريخ آخر دفعة', player.last_payment_date ? formatDate(player.last_payment_date) : '—'],
        ['تاريخ التجديد القادم', player.next_payment_date ? formatDate(player.next_payment_date) : '—'],
      ];
      const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
      XLSX.utils.book_append_sheet(wb, wsInfo, 'البيانات الأساسية');

      // Sheet 2: Payments
      const paymentsData = payments.map(p => ({
        'التاريخ': p.payment_date ? formatDate(p.payment_date) : '—',
        'المبلغ': p.amount,
        'طريقة الدفع': p.method === 'cash' ? 'نقدي' : 'تحويل',
        'الفترة المغطاة': p.period_covered || '—',
        'ملاحظات': p.notes || '—',
      }));
      const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, wsPayments, 'المدفوعات');

      // Sheet 3: Attendance
      const attendanceData = attendance.map(a => ({
        'التاريخ': a.session_date ? formatDate(a.session_date) : '—',
        'الحالة': a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : 'متأخر',
      }));
      const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, wsAttendance, 'سجل الحضور');

      // Sheet 4: Kit Purchases
      const kitsData = kits.map(k => ({
        'المنتج': k.item_name,
        'المقاس': k.size || '—',
        'الكمية': k.quantity,
        'سعر الوحدة': k.unit_price,
        'السعر الإجمالي': k.total_price,
        'المبلغ المدفوع': k.amount_paid,
        'الحالة': k.payment_status === 'paid' ? 'مدفوع بالكامل' : k.payment_status === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع',
        'التاريخ': k.purchase_date ? formatDate(k.purchase_date) : '—',
        'ملاحظات': k.notes || '—',
      }));
      const wsKits = XLSX.utils.json_to_sheet(kitsData);
      XLSX.utils.book_append_sheet(wb, wsKits, 'مشتريات المتجر');

      XLSX.writeFile(wb, `player_report_${player.player_code}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('success', `تم تصدير شيت إكسل للاعب ${player.player_name} بنجاح`);
    } catch (err: any) {
      toast('error', `فشل في التصدير: ${err.message}`);
    } finally {
      setIsExportingPlayer(null);
    }
  }

  function exportToExcel() {
    const wsData = filteredData.map(d => ({
      'الكود': d.player_code,
      'الاسم': d.player_name,
      'المواليد': d.date_of_birth ? d.date_of_birth.substring(0, 4) : '—',
      'الفرع': d.branch_name,
      'المجموعة/الفريق': d.group_name || 'بدون مجموعة',
      'قيمة الاشتراك الدوري': d.fee_amount_periodic,
      'عدد الأرباع': Math.ceil(d.months_enrolled / 3),
      'إجمالي المتوقع (دوري)': d.total_expected_periodic,
      'مديونية الدوري': d.debt_periodic,
      'موعد التجديد': d.next_payment_date ? formatDate(d.next_payment_date) : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللاعبين الدوريين');
    XLSX.writeFile(wb, `league_players_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const rollbackBulkSettlement = async () => {
    if (!confirm('هل أنت متأكد من إلغاء وحذف كافة دفعات "تسوية الشهور القديمة" التي تم تسجيلها آلياً بالخطأ اليوم؟\n\nسيتم استعادة المديونيات الحقيقية لجميع لاعبي الدوري والاشتراكات فوراً.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .or('notes.ilike.%تصفية الشهور القديمة%,notes.ilike.%تسوية الشهور القديمة%');

      if (error) throw error;

      toast('success', 'تم التراجع عن التسوية التلقائية وحذف جميع الدفعات المسجلة بالخطأ بنجاح! 🗑️');
      loadData();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء التراجع: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-arabic flex items-center gap-2">
            🏆 الاشتراكات الدورية (الدوري)
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-arabic">إدارة لاعبي الدوري والفرق وتصدير البيانات</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={rollbackBulkSettlement}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 font-arabic hover:-translate-y-0.5"
            title="إلغاء وحذف كافة الدفعات المسجلة بالخطأ عند الضغط على تسوية الجميع"
          >
            <RotateCcw size={16} /> تراجع عن تسوية الجميع بالخطأ
          </button>
          <button 
            onClick={openAddPlayerForm} 
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 font-arabic hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={16} /> إضافة لاعب دوري
          </button>
          <button 
            onClick={openAddGroupForm} 
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 font-arabic hover:-translate-y-0.5 active:translate-y-0"
          >
            <Users size={16} /> إضافة مجموعة باللاعبين
          </button>
        </div>
      </div>

      {/* Summary — LEAGUE ONLY */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm flex flex-col gap-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
          <div className="bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
            <div className="text-xs text-emerald-700 font-bold mb-1 font-arabic">عدد لاعبي الدوري</div>
            <div className="text-xl font-extrabold text-emerald-700 tabular-nums">{filteredData.length} <span className="text-xs font-medium font-arabic">لاعب</span></div>
          </div>
          <div className="bg-amber-50 px-4 py-3 rounded-lg border border-amber-100">
            <div className="text-xs text-amber-700 font-bold mb-1 font-arabic">إجمالي المتوقع (دوري فقط)</div>
            <div className="text-xl font-extrabold text-amber-700 tabular-nums">{formatMoney(totalExpectedPeriodic)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-red-50 px-4 py-3 rounded-lg border border-red-100">
            <div className="text-xs text-red-700 font-bold mb-1 font-arabic">مديونية الدوري</div>
            <div className="text-xl font-extrabold text-red-600 tabular-nums">{formatMoney(totalDebtPeriodic)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-700 font-bold mb-1 font-arabic">لاعبين بمديونية دوري</div>
            <div className="text-xl font-extrabold text-blue-700 tabular-nums">{debtorsCount} <span className="text-xs font-medium font-arabic">لاعب</span></div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-5 justify-between items-center pt-3 border-t border-slate-100">
          <div className="flex flex-col gap-1 w-full md:w-auto font-arabic">
            <div className="text-sm font-semibold text-slate-700">اللاعبين بمديونية: <span className="font-bold text-red-600">{debtorsCount}</span></div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filter by Team/Group */}
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">كل الفرق / المجموعات</option>
              {groups.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>

            {/* Filter by Birth Year */}
            <select
              value={birthYearFilter}
              onChange={(e) => setBirthYearFilter(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">كل فئات المواليد</option>
              {birthYears.map(year => (
                <option key={year} value={year}>مواليد {year}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 md:w-64 py-2 px-4 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
            />

            {/* Export Excel Button */}
            <button
              onClick={exportToExcel}
              disabled={filteredData.length === 0}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all cursor-pointer shadow-sm flex items-center gap-2 font-arabic"
            >
              📊 تصدير Excel للكل
            </button>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <EmptyState icon="⚽" title="لا يوجد لاعبين دوري" subtitle="لم يتم العثور على لاعبين يطابقون فلاتر البحث الخاصة بك" />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>اللاعب</th>
                  <th>الكود</th>
                  <th>مواليد</th>
                  {!branchFilter && <th>الفرع</th>}
                  <th>المجموعة</th>
                  <th>قيمة الاشتراك الدوري</th>
                  <th>عدد الأرباع</th>
                  <th>المتوقع (دوري)</th>
                  <th>مديونية الدوري</th>
                  <th>موعد التجديد</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(d => (
                  <tr key={d.player_id}>
                    <td className="font-semibold">
                      <Link to={`/players/${d.player_id}`} className="text-slate-900 hover:text-emerald-700 transition-colors no-underline">
                        {d.player_name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{d.player_code}</td>
                    <td className="font-semibold text-slate-600">{d.date_of_birth ? d.date_of_birth.substring(0, 4) : '—'}</td>
                    {!branchFilter && <td><BranchBadge branchId={d.branch_id} branchName={d.branch_name} /></td>}
                    <td className="text-slate-600 text-sm">{d.group_name || '—'}</td>
                    <td className="tabular-data font-bold text-emerald-700">{formatMoney(d.fee_amount_periodic)}</td>
                    <td className="tabular-data text-center">{Math.ceil(d.months_enrolled / 3)}</td>
                    <td className="tabular-data">{formatMoney(d.total_expected_periodic)}</td>
                    <td className={`tabular-data font-bold ${Number(d.debt_periodic) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {Number(d.debt_periodic) > 0 ? formatMoney(d.debt_periodic) : '0'}
                    </td>
                    <td className="text-sm font-bold text-slate-800">{formatDate(d.next_payment_date)}</td>
                    <td>
                      <div className="flex gap-2 items-center flex-wrap">
                        <button
                          onClick={() => handleEditPlayer(d.player_id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer hover:scale-105 active:scale-100"
                          title="تعديل بيانات اللاعب"
                        >
                          <Edit2 size={12} /> تعديل
                        </button>
                        <button
                          onClick={() => setPlayerToDelete({ id: d.player_id, name: d.player_name })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer hover:scale-105 active:scale-100"
                          title="حذف اللاعب نهائياً"
                        >
                          <Trash2 size={12} /> حذف
                        </button>
                        <button
                          onClick={() => exportPlayerExcel(d.player_id, d)}
                          disabled={isExportingPlayer === d.player_id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer hover:scale-105 active:scale-100"
                          title="تصدير كشف إكسل للاعب"
                        >
                          📊 {isExportingPlayer === d.player_id ? 'جاري...' : 'تصدير'}
                        </button>
                        {Number(d.debt_periodic) > 0 && (d.parent_phone || d.phone) && (
                          <a
                            href={buildWhatsAppLink(d.parent_phone || d.phone || '', debtReminderMessage(d.player_name, Number(d.debt_periodic), d.next_payment_date))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 transition-colors no-underline whitespace-nowrap"
                            title="تنبيه بالمديونية"
                          >
                            📱 مديونية
                          </a>
                        )}
                        {d.next_payment_date && (d.parent_phone || d.phone) && (
                          <a
                            href={buildWhatsAppLink(d.parent_phone || d.phone || '', renewalReminderMessage(d.player_name, d.next_payment_date, d.last_payment_date))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-bold hover:bg-emerald-600 transition-colors no-underline whitespace-nowrap"
                            title="تذكير بالتجديد"
                          >
                            📅 تجديد
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit League Player Modal */}
      <Modal 
        isOpen={showPlayerModal} 
        onClose={() => setShowPlayerModal(false)} 
        title={editingPlayer ? 'تعديل بيانات لاعب الدوري' : 'إضافة لاعب جديد للدوري'} 
        size="lg"
        footer={
          <>
            <button 
              onClick={savePlayer} 
              disabled={isSaving} 
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? 'جاري الحفظ...' : editingPlayer ? 'حفظ التعديلات' : 'إضافة اللاعب'}
            </button>
            <button 
              onClick={() => setShowPlayerModal(false)} 
              disabled={isSaving} 
              className="px-5 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">الاسم بالكامل *</label>
            <input 
              value={playerForm.full_name} 
              onChange={(e) => setPlayerForm(f => ({ ...f, full_name: e.target.value }))}
              className="input-field" 
              placeholder="اسم اللاعب" 
            />
          </div>
          <div>
            <label className="form-label">الفرع *</label>
            <select 
              value={playerForm.branch_id} 
              onChange={(e) => setPlayerForm(f => ({ ...f, branch_id: e.target.value }))}
              className="input-field cursor-pointer"
            >
              <option value="">اختر الفرع</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">قيمة الاشتراك الدوري (ج.م) *</label>
            <input 
              type="number" 
              value={playerForm.fee_amount_periodic} 
              onChange={(e) => setPlayerForm(f => ({ ...f, fee_amount_periodic: e.target.value }))}
              className="input-field font-tabular" 
              placeholder="مثال: 1200" 
              dir="ltr" 
            />
          </div>
          <div>
            <label className="form-label">الفئة العمرية (سنة الميلاد) *</label>
            <select 
              value={playerForm.birth_year} 
              onChange={(e) => setPlayerForm(f => ({ ...f, birth_year: e.target.value }))} 
              className="input-field cursor-pointer"
            >
              {Array.from({ length: 18 }, (_, i) => new Date().getFullYear() - 17 + i).map(year => (
                <option key={year} value={year.toString()}>مواليد {year} (فئة U-{new Date().getFullYear() - year})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">تاريخ الميلاد (اختياري)</label>
            <input 
              type="date" 
              value={playerForm.date_of_birth} 
              onChange={(e) => setPlayerForm(f => ({ ...f, date_of_birth: e.target.value }))}
              className="input-field font-tabular" 
            />
          </div>
          <div>
            <label className="form-label">تاريخ التسجيل والاشتراك *</label>
            <input 
              type="date" 
              value={playerForm.registration_date} 
              onChange={(e) => setPlayerForm(f => ({ ...f, registration_date: e.target.value }))}
              className="input-field font-tabular" 
            />
          </div>
          <div>
            <label className="form-label">رقم الهاتف</label>
            <input 
              value={playerForm.phone} 
              onChange={(e) => setPlayerForm(f => ({ ...f, phone: e.target.value }))}
              className="input-field font-tabular" 
              placeholder="01xxxxxxxxx" 
              dir="ltr" 
            />
          </div>
          <div>
            <label className="form-label">هاتف ولي الأمر</label>
            <input 
              value={playerForm.parent_phone} 
              onChange={(e) => setPlayerForm(f => ({ ...f, parent_phone: e.target.value }))}
              className="input-field font-tabular" 
              placeholder="01xxxxxxxxx" 
              dir="ltr" 
            />
          </div>
          <div>
            <label className="form-label">المجموعة / الفريق (اختياري)</label>
            <select 
              value={playerForm.group_id} 
              onChange={(e) => setPlayerForm(f => ({ ...f, group_id: e.target.value }))}
              className="input-field cursor-pointer"
            >
              <option value="">بدون فريق</option>
              {groups
                .filter(g => !playerForm.branch_id || g.branch_id === playerForm.branch_id)
                .map(g => <option key={g.id} value={g.id}>{g.name}</option>)
              }
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="form-label">ملاحظات</label>
            <textarea 
              value={playerForm.notes} 
              onChange={(e) => setPlayerForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none h-20" 
              placeholder="ملاحظات إضافية..." 
            />
          </div>
        </div>
      </Modal>

      {/* Add Group Modal */}
      <Modal 
        isOpen={showGroupModal} 
        onClose={() => setShowGroupModal(false)} 
        title="إضافة مجموعة جديدة وضم لاعبين" 
        size="lg"
        footer={
          <>
            <button 
              onClick={saveGroup} 
              disabled={isSaving} 
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? 'جاري الحفظ...' : 'إنشاء المجموعة'}
            </button>
            <button 
              onClick={() => setShowGroupModal(false)} 
              disabled={isSaving} 
              className="px-5 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="form-label">اسم الفريق / المجموعة التدريبية *</label>
              <input 
                value={groupForm.name} 
                onChange={(e) => setGroupForm(f => ({ ...f, name: e.target.value }))}
                className="input-field" 
                placeholder="مثال: U12 فئة المواليد" 
              />
            </div>
            <div>
              <label className="form-label">الفرع *</label>
              <select 
                value={groupForm.branch_id} 
                onChange={(e) => setGroupForm(f => ({ ...f, branch_id: e.target.value }))}
                className="input-field cursor-pointer"
              >
                <option value="">اختر الفرع</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">المدرب المسؤول</label>
              <select 
                value={groupForm.coach_id} 
                onChange={(e) => setGroupForm(f => ({ ...f, coach_id: e.target.value }))}
                className="input-field cursor-pointer"
              >
                <option value="">-- بدون مدرب محدد --</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">موعد التدريب (توقيت)</label>
              <input 
                type="time" 
                value={groupForm.schedule_time} 
                onChange={(e) => setGroupForm(f => ({ ...f, schedule_time: e.target.value }))} 
                className="input-field font-tabular" 
              />
            </div>
            <div>
              <label className="form-label mb-2 block font-arabic text-xs">أيام التدريب</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map(day => {
                  const isActive = groupForm.schedule_days.includes(day.id);
                  return (
                    <button 
                      type="button"
                      key={day.id} 
                      onClick={() => toggleGroupDay(day.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                        isActive 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                      }`}
                    >
                      {day.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Players Checkbox List */}
          <div className="flex flex-col h-full">
            <label className="form-label mb-1.5 block">ضم لاعبين للمجموعة الجديدة</label>
            <input
              type="text"
              placeholder="البحث بالاسم أو الكود..."
              value={playerSearchQuery}
              onChange={(e) => setPlayerSearchQuery(e.target.value)}
              className="input-field mb-2 text-xs"
            />
            <div className="border border-slate-200 rounded-lg p-2 max-h-[260px] overflow-y-auto grid grid-cols-1 gap-1.5 bg-slate-50">
              {availablePlayers.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8 font-arabic">لا يوجد لاعبين متاحين للفرع المحدد</div>
              ) : filteredPlayersForGroup.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8 font-arabic">لم يتم العثور على نتائج للبحث</div>
              ) : (
                filteredPlayersForGroup.map(p => {
                  const isChecked = groupForm.selected_player_ids.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-slate-100 bg-white shadow-sm">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setGroupForm(g => {
                            const ids = g.selected_player_ids.includes(p.id)
                              ? g.selected_player_ids.filter(id => id !== p.id)
                              : [...g.selected_player_ids, p.id];
                            return { ...g, selected_player_ids: ids };
                          });
                        }}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-slate-800 font-arabic truncate">{p.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">{p.player_code}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Player Modal */}
      <ConfirmModal
        isOpen={!!playerToDelete}
        onClose={() => setPlayerToDelete(null)}
        onConfirm={confirmDeletePlayer}
        title="تأكيد حذف لاعب الدوري نهائياً"
        message={`هل أنت متأكد من حذف اللاعب "${playerToDelete?.name}" تماماً من النظام؟\nسيتم مسح كود اللاعب وجميع سجلات المدفوعات والحضور المرتبطة به نهائياً ولا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف اللاعب"
        cancelText="إلغاء الإجراء"
        variant="danger"
        isLoading={isDeleting}
      />

    </div>
  );
}
