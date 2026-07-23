import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatMonth, getCurrentMonth, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { CheckCircle2, XCircle, Check, PauseCircle, Calendar, Building2, RotateCcw } from 'lucide-react';

interface SimpleMonthPlayer {
  id: string;
  full_name: string;
  player_code: string;
  branch_id: string;
  branch_name: string;
  group_name: string;
  fee_amount: number;
  phone: string | null;
  parent_phone: string | null;
  status: string;
  is_paid: boolean;
  payment_date?: string;
  payment_id?: string;
  registration_date?: string;
}

const CLOSING_DAYS: Record<string, number> = {
  'الثلاثي': 20,
  'ملعب جرين هيلز': 30,
  'رويال': 1,
};

export default function DebtsPage() {
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [playersList, setPlayersList] = useState<SimpleMonthPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [playerToPay, setPlayerToPay] = useState<SimpleMonthPlayer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [settlingBranchId, setSettlingBranchId] = useState<string | null>(null);
  const [rollingBackBranchId, setRollingBackBranchId] = useState<string | null>(null);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active monthly players
      const pQuery = supabase
        .from('players')
        .select('id, full_name, player_code, branch_id, fee_amount, phone, parent_phone, status, registration_date, created_at, groups(name), branches(name, closing_day)')
        .eq('status', 'active')
        .gt('fee_amount', 0);

      // 2. Fetch payments recorded for the selected month (period_covered = selectedMonth)
      const payQuery = supabase
        .from('payments')
        .select('id, player_id, amount, payment_date, period_covered')
        .eq('period_covered', selectedMonth);

      const [{ data: playersData }, { data: monthPayments }] = await Promise.all([
        pQuery,
        payQuery,
      ]);

      const paidPlayerMap = new Map<string, { payment_date: string; payment_id: string }>();
      (monthPayments || []).forEach((p: any) => {
        paidPlayerMap.set(p.player_id, { payment_date: p.payment_date, payment_id: p.id });
      });

      const [selY, selM] = selectedMonth.split('-').map(Number);

      // ⚡ FILTER PLAYERS DUE FOR selectedMonth:
      // If player registered in selY-selM AFTER branch closing_day -> NOT DUE for selY-selM! Due starting next month!
      const duePlayers: SimpleMonthPlayer[] = [];

      (playersData || []).forEach((p: any) => {
        const regDateStr = p.registration_date || (p.created_at ? p.created_at.split('T')[0] : '2026-07-01');
        const regDate = new Date(regDateStr);
        const regY = regDate.getFullYear();
        const regM = regDate.getMonth() + 1;
        const regD = regDate.getDate();

        const branchName = p.branches?.name || '';
        const closingDay = p.branches?.closing_day || CLOSING_DAYS[branchName.trim()] || 30;

        // Check if player registered AFTER selectedMonth OR (in selectedMonth AFTER closingDay)
        if (regY > selY || (regY === selY && regM > selM)) {
          // Registered in future month -> not due yet
          return;
        }

        if (regY === selY && regM === selM && regD > closingDay) {
          // Registered in selected month AFTER closing day -> first due in next month!
          return;
        }

        const paymentInfo = paidPlayerMap.get(p.id);

        duePlayers.push({
          id: p.id,
          full_name: p.full_name,
          player_code: p.player_code,
          branch_id: p.branch_id,
          branch_name: branchName || '—',
          group_name: p.groups?.name || '—',
          fee_amount: Number(p.fee_amount || 0),
          phone: p.phone,
          parent_phone: p.parent_phone,
          status: p.status,
          is_paid: !!paymentInfo,
          payment_date: paymentInfo?.payment_date,
          payment_id: paymentInfo?.payment_id,
          registration_date: regDateStr,
        });
      });

      setPlayersList(duePlayers);
    } catch (err: any) {
      console.error('Error loading month data:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  useRealtimeRefresh(['players', 'payments'], loadMonthData);

  // === Per-branch stats ===
  const getBranchStats = (branchId: string) => {
    const branchPlayers = playersList.filter(p => p.branch_id === branchId);
    const paid = branchPlayers.filter(p => p.is_paid).length;
    const unpaid = branchPlayers.filter(p => !p.is_paid).length;
    const collected = branchPlayers.filter(p => p.is_paid).reduce((s, p) => s + p.fee_amount, 0);
    return { total: branchPlayers.length, paid, unpaid, collected };
  };

  const getClosingDayLabel = (branchName: string, closingDay?: number) => {
    const cd = closingDay || CLOSING_DAYS[branchName.trim()] || 30;
    return `يوم ${cd} من كل شهر`;
  };

  // Filtered players (by selected branch + status + search)
  const filteredData = playersList.filter((p) => {
    if (branchFilter && p.branch_id !== branchFilter) return false;
    if (statusFilter === 'paid' && !p.is_paid) return false;
    if (statusFilter === 'unpaid' && p.is_paid) return false;
    if (searchQuery && !p.full_name.includes(searchQuery) && !p.player_code.includes(searchQuery)) return false;
    return true;
  });

  // Global KPIs (for current view)
  const viewPlayers = branchFilter ? playersList.filter(p => p.branch_id === branchFilter) : playersList;
  const paidPlayersCount = viewPlayers.filter(p => p.is_paid).length;
  const unpaidPlayersCount = viewPlayers.filter(p => !p.is_paid).length;
  const totalCollectedThisMonth = viewPlayers.filter(p => p.is_paid).reduce((s, p) => s + p.fee_amount, 0);

  const selectedBranchObj = branches.find((b) => b.id === branchFilter);
  const currentBranchTitle = selectedBranchObj ? selectedBranchObj.name : 'جميع الفروع';

  // === Actions ===
  const openPayModal = (player: SimpleMonthPlayer) => {
    setPlayerToPay(player);
    setPayAmount(String(player.fee_amount || 0));
    setPayMethod('cash');
  };

  const handleConfirmPay = async () => {
    if (!playerToPay) return;
    if (playerToPay.is_paid) {
      toast('info', `اللاعب (${playerToPay.full_name}) مسدد بالفعل لشهر ${formatMonth(selectedMonth)} ✅`);
      setPlayerToPay(null);
      return;
    }
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast('error', 'يرجى إدخال مبلغ سداد صحيح');
      return;
    }
    setIsSubmittingPay(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('payments').insert({
        player_id: playerToPay.id,
        branch_id: playerToPay.branch_id,
        amount: amountNum,
        payment_date: todayStr,
        method: payMethod,
        period_covered: selectedMonth,
        notes: `سداد اشتراك شهر ${formatMonth(selectedMonth)}`,
      });
      if (error) throw error;
      toast('success', `تم تسجيل سداد شهر ${formatMonth(selectedMonth)} للاعب (${playerToPay.full_name}) بنجاح ✅`);
      setPlayerToPay(null);
      setTimeout(() => loadMonthData(), 500);
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء تسديد الاشتراك: ' + err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // ✅ Settle entire branch (PREVENT DUPLICATE PAYMENTS)
  const handleSettleBranch = async (branchId: string, branchName: string) => {
    const unpaidPlayers = playersList.filter(p => p.branch_id === branchId && !p.is_paid);
    if (unpaidPlayers.length === 0) {
      toast('info', `جميع لاعبي فرع (${branchName}) المستحقين لشهر ${formatMonth(selectedMonth)} مسددين بالفعل ✅`);
      return;
    }
    if (!window.confirm(`⚠️ تسديد جماعي\n\nهل أنت متأكد من تسديد اشتراك شهر (${formatMonth(selectedMonth)}) لجميع لاعبي فرع (${branchName}) غير المسددين (${unpaidPlayers.length} لاعب)؟`)) return;

    setSettlingBranchId(branchId);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const newPayments = unpaidPlayers.map(p => ({
        player_id: p.id,
        branch_id: p.branch_id,
        amount: p.fee_amount,
        payment_date: todayStr,
        method: 'cash',
        period_covered: selectedMonth,
        notes: `سداد جماعي لفرع ${branchName} لشهر ${formatMonth(selectedMonth)}`,
      }));

      const { error } = await supabase.from('payments').insert(newPayments);
      if (error) throw error;
      toast('success', `✅ تم تسديد شهر ${formatMonth(selectedMonth)} لجميع لاعبي فرع (${branchName}) المستحقين — ${unpaidPlayers.length} لاعب`);
      setTimeout(() => loadMonthData(), 800);
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء التسديد الجماعي: ' + err.message);
    } finally {
      setSettlingBranchId(null);
    }
  };

  // 🔄 Rollback: delete all payments for this branch + this month
  const handleRollbackBranch = async (branchId: string, branchName: string) => {
    const paidPlayers = playersList.filter(p => p.branch_id === branchId && p.is_paid);
    if (paidPlayers.length === 0) {
      toast('info', `لا توجد دفعات مسجلة لفرع (${branchName}) في شهر ${formatMonth(selectedMonth)} لإرجاعها`);
      return;
    }
    if (!window.confirm(`⚠️ إرجاع التسديد الجماعي\n\nهل أنت متأكد من إرجاع جميع دفعات شهر (${formatMonth(selectedMonth)}) لفرع (${branchName})؟\n\nسيتم حذف ${paidPlayers.length} عملية دفع نهائياً!`)) return;

    setRollingBackBranchId(branchId);
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('branch_id', branchId)
        .eq('period_covered', selectedMonth);

      if (error) throw error;
      toast('success', `🔄 تم إرجاع جميع دفعات شهر ${formatMonth(selectedMonth)} لفرع (${branchName}) بنجاح — ${paidPlayers.length} عملية`);
      setTimeout(() => loadMonthData(), 800);
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء إرجاع الدفعات: ' + err.message);
    } finally {
      setRollingBackBranchId(null);
    }
  };

  // Freeze Player
  const handleFreezePlayer = async (player: SimpleMonthPlayer) => {
    if (!window.confirm(`هل أنت متأكد من تجميد حساب اللاعب (${player.full_name}) وإيقاف جميع اشتراكاته فوراً؟`)) return;
    try {
      const { error } = await supabase.from('players').update({ status: 'suspended' }).eq('id', player.id);
      if (error) throw error;
      toast('success', `تم تجميد حساب اللاعب (${player.full_name}) بنجاح ⏸️`);
      setPlayersList(prev => prev.filter(p => p.id !== player.id));
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء تجميد اللاعب: ' + err.message);
    }
  };

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`space-y-6 animate-fade-in font-[Cairo] ${loading && !initialLoading ? 'opacity-60 pointer-events-none' : ''}`}>

      {/* ═══════════════════════════════════════════════════════════════
          HEADER + MONTH SELECTOR
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              ⚽ متابعة سداد الاشتراكات الشهرية
            </h1>
            <p className="text-slate-500 text-sm font-semibold mt-1">
              مستحقات شهر <strong className="text-emerald-700 font-tabular">{formatMonth(selectedMonth)}</strong> حسب أيام تقفيل الفروع (قبل التقفيل = الشهر الحالي، بعد التقفيل = الشهر القادم)
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border border-slate-200 rounded-xl shadow-2xs">
            <Calendar size={18} className="text-emerald-600" />
            <span className="text-slate-500 font-bold text-sm">اختر الشهر:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-transparent font-tabular font-extrabold text-slate-800 focus:outline-none cursor-pointer text-sm"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PER-BRANCH CONTROL CARDS
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {branches.map((branch) => {
          const stats = getBranchStats(branch.id);
          const closingLabel = getClosingDayLabel(branch.name, branch.closing_day);
          const isAllPaid = stats.unpaid === 0 && stats.total > 0;
          const isSettling = settlingBranchId === branch.id;
          const isRollingBack = rollingBackBranchId === branch.id;

          return (
            <div
              key={branch.id}
              className={`rounded-2xl border-2 p-5 md:p-6 shadow-sm transition-all ${
                isAllPaid
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Branch Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                    isAllPaid ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-slate-900">{branch.name}</h3>
                    <p className="text-[11px] text-slate-400 font-bold">التقفيل: {closingLabel}</p>
                  </div>
                </div>
                {isAllPaid && (
                  <span className="text-emerald-600 text-xl">✅</span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <div className="text-lg md:text-xl font-extrabold text-slate-800 font-tabular">{stats.total}</div>
                  <div className="text-[10px] font-bold text-slate-500">مستحقين لشهر {formatMonth(selectedMonth)}</div>
                </div>
                <div className={`rounded-xl p-3 text-center border ${isAllPaid ? 'bg-emerald-100 border-emerald-200' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="text-lg md:text-xl font-extrabold text-emerald-700 font-tabular">{stats.paid}</div>
                  <div className="text-[10px] font-bold text-emerald-600">مسدد ✅</div>
                </div>
                <div className={`rounded-xl p-3 text-center border ${stats.unpaid > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`text-lg md:text-xl font-extrabold font-tabular ${stats.unpaid > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{stats.unpaid}</div>
                  <div className={`text-[10px] font-bold ${stats.unpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`}>غير مسدد</div>
                </div>
              </div>

              {/* Collected Amount */}
              <div className="bg-slate-50 rounded-xl p-3 mb-5 border border-slate-100 text-center">
                <div className="text-[11px] font-bold text-slate-500 mb-0.5">إجمالي المحصل لشهر {formatMonth(selectedMonth)}</div>
                <div className="text-xl md:text-2xl font-extrabold text-emerald-800 font-tabular">
                  {formatMoney(stats.collected)} <span className="text-xs font-bold text-slate-500">ج.م</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {/* ✅ Settle All */}
                <button
                  onClick={() => handleSettleBranch(branch.id, branch.name)}
                  disabled={isSettling || isRollingBack || isAllPaid}
                  className={`w-full py-3 md:py-3.5 rounded-xl font-extrabold text-sm md:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed ${
                    isAllPaid
                      ? 'bg-emerald-200 text-emerald-700 border border-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg active:scale-[0.98]'
                  } disabled:opacity-60`}
                >
                  {isSettling ? (
                    <>⏳ جاري التسديد...</>
                  ) : isAllPaid ? (
                    <>✅ تم تسديد الشهر بالكامل</>
                  ) : (
                    <>
                      <Check size={20} />
                      تسديد شهر {formatMonth(selectedMonth)} بالكامل ({stats.unpaid} لاعب)
                    </>
                  )}
                </button>

                {/* 🔄 Rollback */}
                <button
                  onClick={() => handleRollbackBranch(branch.id, branch.name)}
                  disabled={isRollingBack || isSettling || stats.paid === 0}
                  className="w-full py-2.5 md:py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRollingBack ? (
                    <>⏳ جاري الإرجاع...</>
                  ) : (
                    <>
                      <RotateCcw size={18} />
                      إرجاع تسديد شهر {formatMonth(selectedMonth)} ({stats.paid} عملية)
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          GLOBAL KPI SUMMARY
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-emerald-700 font-bold mb-1">💰 إجمالي المحصل — {formatMonth(selectedMonth)} ({currentBranchTitle})</div>
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-900 font-tabular">
              {formatMoney(totalCollectedThisMonth)} <span className="text-sm font-bold">ج.م</span>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-blue-700 font-bold mb-1">✅ المسددين — {formatMonth(selectedMonth)} ({currentBranchTitle})</div>
            <div className="text-2xl md:text-3xl font-extrabold text-blue-900 font-tabular">
              {paidPlayersCount} <span className="text-sm font-bold">لاعب</span>
            </div>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-rose-700 font-bold mb-1">⏳ غير المسددين — {formatMonth(selectedMonth)} ({currentBranchTitle})</div>
            <div className="text-2xl md:text-3xl font-extrabold text-rose-900 font-tabular">
              {unpaidPlayersCount} <span className="text-sm font-bold">لاعب</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FILTER TABS + SEARCH
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({viewPlayers.length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            ✅ مسدد ({paidPlayersCount})
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              statusFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            ⏳ غير مسدد ({unpaidPlayersCount})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 بحث باسم اللاعب أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 px-4 pr-4 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PLAYERS TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {filteredData.length === 0 ? (
        <EmptyState icon="✅" title="لا توجد نتائج" subtitle="لم يتم العثور على لاعبين مستحقين لشهر السداد المختار" />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">اللاعب</th>
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm hidden sm:table-cell">الكود</th>
                  {!branchFilter && <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">الفرع</th>}
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm hidden md:table-cell">المجموعة</th>
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">الاشتراك</th>
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm text-center">الحالة</th>
                  <th className="px-4 md:px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 md:px-5 py-3.5 md:py-4 font-extrabold text-slate-900 text-sm">
                      {p.full_name}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 md:py-4 font-mono text-xs text-slate-500 font-bold hidden sm:table-cell">
                      {p.player_code}
                    </td>
                    {!branchFilter && (
                      <td className="px-4 md:px-5 py-3.5 md:py-4">
                        <BranchBadge branchId={p.branch_id} branchName={p.branch_name} />
                      </td>
                    )}
                    <td className="px-4 md:px-5 py-3.5 md:py-4 text-xs font-semibold text-slate-600 hidden md:table-cell">
                      {p.group_name}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 md:py-4 font-extrabold text-slate-900 text-sm font-tabular">
                      {formatMoney(p.fee_amount)}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 md:py-4 text-center">
                      {p.is_paid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] md:text-xs font-extrabold border border-emerald-200">
                          <CheckCircle2 size={14} className="text-emerald-600" /> مسدد ✅
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] md:text-xs font-extrabold border border-rose-200">
                          <XCircle size={14} className="text-rose-600" /> غير مسدد
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 md:py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!p.is_paid ? (
                          <button
                            onClick={() => openPayModal(p)}
                            className="px-3 md:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] md:text-xs font-extrabold transition-all shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                          >
                            <Check size={14} /> تسديد
                          </button>
                        ) : (
                          <span className="text-[10px] md:text-xs text-slate-400 font-bold font-tabular">
                            {formatDate(p.payment_date || '')}
                          </span>
                        )}
                        <button
                          onClick={() => handleFreezePlayer(p)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="تجميد"
                        >
                          <PauseCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PAY MODAL
      ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!playerToPay}
        onClose={() => setPlayerToPay(null)}
        title="🟢 تسديد اشتراك الشهر"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleConfirmPay}
              disabled={isSubmittingPay}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingPay ? '⏳ جاري...' : '✅ تأكيد التسديد'}
            </button>
            <button onClick={() => setPlayerToPay(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer">
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-950 text-sm font-bold space-y-1">
            <div>اللاعب: <span className="font-extrabold text-emerald-900">{playerToPay?.full_name}</span></div>
            <div>الشهر: <span className="font-extrabold text-emerald-700 font-tabular">{formatMonth(selectedMonth)}</span></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (ج.م)</label>
            <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">طريقة الدفع</label>
            <select value={payMethod} onChange={(e: any) => setPayMethod(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:outline-none cursor-pointer">
              <option value="cash">💵 نقدي (كاش)</option>
              <option value="transfer">🏦 تحويل بنكي</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
