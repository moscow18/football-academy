import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatMonth, getCurrentMonth, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { CheckCircle2, XCircle, Search, Check, PauseCircle, Calendar, Building2 } from 'lucide-react';

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
}

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
  const [isBulkBranchSubmitting, setIsBulkBranchSubmitting] = useState(false);
  const [showBranchSettleModal, setShowBranchSettleModal] = useState(false);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const branchId = branchFilter || null;

      // 1. Fetch active monthly players ONLY (status = active)
      let pQuery = supabase
        .from('players')
        .select('id, full_name, player_code, branch_id, fee_amount, phone, parent_phone, status, groups(name), branches(name)')
        .eq('status', 'active')
        .gt('fee_amount', 0);

      if (branchId) pQuery = pQuery.eq('branch_id', branchId);

      // 2. Fetch payments for the selected month
      const startOfMonth = `${selectedMonth}-01`;
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${selectedMonth}-${lastDay < 10 ? '0' + lastDay : lastDay}`;

      let payQuery = supabase
        .from('payments')
        .select('id, player_id, amount, payment_date, period_covered')
        .gte('payment_date', startOfMonth)
        .lte('payment_date', endOfMonth);

      const [{ data: playersData }, { data: monthPayments }] = await Promise.all([
        pQuery,
        payQuery,
      ]);

      const paidPlayerMap = new Map<string, { payment_date: string; payment_id: string }>();
      (monthPayments || []).forEach((p: any) => {
        paidPlayerMap.set(p.player_id, { payment_date: p.payment_date, payment_id: p.id });
      });

      const mapped: SimpleMonthPlayer[] = (playersData || []).map((p: any) => {
        const paymentInfo = paidPlayerMap.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          player_code: p.player_code,
          branch_id: p.branch_id,
          branch_name: p.branches?.name || '—',
          group_name: p.groups?.name || '—',
          fee_amount: Number(p.fee_amount || 0),
          phone: p.phone,
          parent_phone: p.parent_phone,
          status: p.status,
          is_paid: !!paymentInfo,
          payment_date: paymentInfo?.payment_date,
          payment_id: paymentInfo?.payment_id,
        };
      });

      setPlayersList(mapped);
    } catch (err: any) {
      console.error('Error loading month data:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [branchFilter, selectedMonth]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  // ⚡ Realtime: auto-refresh when players or payments change
  useRealtimeRefresh(['players', 'payments'], loadMonthData);

  // Filtered players
  const filteredData = playersList.filter((p) => {
    if (statusFilter === 'paid' && !p.is_paid) return false;
    if (statusFilter === 'unpaid' && p.is_paid) return false;
    if (searchQuery && !p.full_name.includes(searchQuery) && !p.player_code.includes(searchQuery)) return false;
    return true;
  });

  // KPI Totals
  const paidPlayersCount = playersList.filter((p) => p.is_paid).length;
  const unpaidPlayersCount = playersList.filter((p) => !p.is_paid).length;
  const totalCollectedThisMonth = playersList
    .filter((p) => p.is_paid)
    .reduce((s, p) => s + p.fee_amount, 0);

  // Current branch name
  const selectedBranchObj = branches.find((b) => b.id === branchFilter);
  const currentBranchTitle = selectedBranchObj ? selectedBranchObj.name : 'جميع الفروع';

  // 1-Click Pay Single Player
  const openPayModal = (player: SimpleMonthPlayer) => {
    setPlayerToPay(player);
    setPayAmount(String(player.fee_amount || 0));
    setPayMethod('cash');
  };

  const handleConfirmPay = async () => {
    if (!playerToPay) return;
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
      // Wait a moment for DB to propagate, then reload
      setTimeout(() => loadMonthData(), 500);
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء تسديد الاشتراك: ' + err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Bulk Settle FOR A SPECIFIC TARGET BRANCH
  const settleSpecificBranch = async (targetBranchId: string, targetBranchName: string) => {
    setIsBulkBranchSubmitting(true);
    try {
      const unpaidPlayers = playersList.filter((p) => p.branch_id === targetBranchId && !p.is_paid);
      if (unpaidPlayers.length === 0) {
        toast('info', `جميع لاعبي فرع (${targetBranchName}) مسددين بالفعل لهذا الشهر ✅`);
        setShowBranchSettleModal(false);
        return;
      }

      if (!window.confirm(`هل أنت متأكد من تسديد اشتراك شهر (${formatMonth(selectedMonth)}) لجميع لاعبي فرع (${targetBranchName}) البالغ عددهم ${unpaidPlayers.length} لاعب؟`)) {
        setIsBulkBranchSubmitting(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const newPayments = unpaidPlayers.map((p) => ({
        player_id: p.id,
        branch_id: p.branch_id,
        amount: p.fee_amount,
        payment_date: todayStr,
        method: 'cash',
        period_covered: selectedMonth,
        notes: `سداد جماعي لفرع ${targetBranchName} لشهر ${formatMonth(selectedMonth)}`,
      }));

      const { error } = await supabase.from('payments').insert(newPayments);
      if (error) throw error;

      toast('success', `تم تسديد اشتراك شهر ${formatMonth(selectedMonth)} لجميع لاعبي فرع (${targetBranchName}) لـ ${unpaidPlayers.length} لاعب بنجاح ✅`);
      setShowBranchSettleModal(false);
      // Wait for DB propagation then reload fresh data
      setTimeout(() => loadMonthData(), 800);
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء التسديد الجماعي للفرع: ' + err.message);
    } finally {
      setIsBulkBranchSubmitting(false);
    }
  };

  const handleHeaderBranchSettleClick = () => {
    if (branchFilter) {
      const bObj = branches.find((b) => b.id === branchFilter);
      settleSpecificBranch(branchFilter, bObj ? bObj.name : 'الفرع المحدد');
    } else {
      setShowBranchSettleModal(true);
    }
  };

  // Freeze / Suspend Player
  const handleFreezePlayer = async (player: SimpleMonthPlayer) => {
    if (!window.confirm(`هل أنت متأكد من تجميد حساب اللاعب (${player.full_name}) وإيقاف جميع اشتراكاته فوراً؟\n\nلن يظهر هذا اللاعب في المديونيات أو التحصيل بعد الآن.`)) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({ status: 'suspended' })
        .eq('id', player.id);

      if (error) throw error;

      toast('success', `تم تجميد حساب اللاعب (${player.full_name}) وإيقاف جميع اشتراكاته بنجاح ⏸️`);
      setPlayersList((prev) => prev.filter((p) => p.id !== player.id));
      loadMonthData();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء تجميد اللاعب: ' + err.message);
    }
  };

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`space-y-6 animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-arabic flex items-center gap-2">
            ⚽ متابعة سداد الاشتراكات الشهرية ({currentBranchTitle})
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1 font-arabic">
            جدول ميسّر لمتابعة سداد كل لاعب لشهر <strong className="text-emerald-700 font-tabular">{formatMonth(selectedMonth)}</strong> بنقرة واحدة ✅
          </p>
        </div>

        {/* Month Selector & Branch Settle Button */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto font-[Cairo]">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl shadow-2xs">
            <Calendar size={16} className="text-emerald-600" />
            <span className="text-slate-500 font-bold text-xs font-arabic">اختر الشهر:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-transparent font-tabular font-bold text-slate-800 focus:outline-none cursor-pointer focus:ring-0 text-sm font-[Cairo]"
            />
          </div>

          <button
            onClick={handleHeaderBranchSettleClick}
            disabled={isBulkBranchSubmitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer font-arabic disabled:opacity-50 hover:scale-105 active:scale-95"
            title="تسديد شهر لفرع معين بنقرة واحدة"
          >
            <Building2 size={16} />
            <span>تسديد شهر {branchFilter ? `(${currentBranchTitle})` : 'فرع محدد'} بالكامل ✅</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Only Total Collected & Paid Counts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-[Cairo]">
        {/* Total Collected */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-emerald-700 font-bold mb-1">إجمالي المحصل لـ ({formatMonth(selectedMonth)})</div>
            <div className="text-3xl font-extrabold text-emerald-900 font-tabular">
              {formatMoney(totalCollectedThisMonth)} <span className="text-sm font-bold">ج.م</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            💰
          </div>
        </div>

        {/* Paid Players Count */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-blue-700 font-bold mb-1">اللاعبين المسددين لـ ({formatMonth(selectedMonth)})</div>
            <div className="text-3xl font-extrabold text-blue-900 font-tabular">
              {paidPlayersCount} <span className="text-sm font-bold">لاعب ✅</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Unpaid Players Count */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs text-rose-700 font-bold mb-1">اللاعبين غير المسددين بعد</div>
            <div className="text-3xl font-extrabold text-rose-900 font-tabular">
              {unpaidPlayersCount} <span className="text-sm font-bold">لاعب ⏳</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            <XCircle size={24} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 font-[Cairo]">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({playersList.length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            🟢 المسددين فقط ({paidPlayersCount})
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            🔴 غير المسددين ({unpaidPlayersCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="بحث باسم اللاعب أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-4 pr-9 border border-slate-200 rounded-xl font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
          />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        </div>
      </div>

      {/* Main Players Checkmark Table */}
      {filteredData.length === 0 ? (
        <EmptyState icon="✅" title="لا توجد نتائج" subtitle="لم يتم العثور على لاعبين يطابقون فلتر البحث" />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right font-[Cairo]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs">اللاعب</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs">الكود</th>
                  {!branchFilter && <th className="px-5 py-3.5 text-slate-600 font-bold text-xs">الفرع</th>}
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs">المجموعة</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs">قيمة الاشتراك</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs text-center">حالة سداد شهر ({formatMonth(selectedMonth)})</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs text-center">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-extrabold text-slate-900 text-sm">
                      {p.full_name}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 font-bold">
                      {p.player_code}
                    </td>
                    {!branchFilter && (
                      <td className="px-5 py-4">
                        <BranchBadge branchId={p.branch_id} branchName={p.branch_name} />
                      </td>
                    )}
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                      {p.group_name}
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-900 text-sm font-tabular">
                      {formatMoney(p.fee_amount)} <span className="text-[10px] text-slate-400 font-bold">ج.م/شهر</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {p.is_paid ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-extrabold border border-emerald-200 shadow-2xs">
                          <CheckCircle2 size={15} className="text-emerald-600" /> تم السداد ✅
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-extrabold border border-rose-200">
                          <XCircle size={15} className="text-rose-600" /> غير مسدد ⏳
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {!p.is_paid ? (
                          <button
                            onClick={() => openPayModal(p)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                            title="تسديد الاشتراك لهذا الشهر بنقرة واحدة"
                          >
                            <Check size={16} /> تسديد هذا الشهر ✅
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold font-tabular">
                            مسدد بتاريخ ({formatDate(p.payment_date || '')})
                          </span>
                        )}

                        <button
                          onClick={() => handleFreezePlayer(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="تجميد وتوقيف الاشتراك نهائياً"
                        >
                          <PauseCircle size={17} />
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

      {/* 1-Click Pay Modal */}
      <Modal
        isOpen={!!playerToPay}
        onClose={() => setPlayerToPay(null)}
        title="🟢 تسديد اشتراك الشهر بنقرة واحدة"
        footer={
          <div className="flex gap-2 justify-end font-[Cairo]">
            <button
              onClick={handleConfirmPay}
              disabled={isSubmittingPay}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingPay ? 'جاري التسجيل...' : 'تأكيد التسديد ✅'}
            </button>
            <button
              onClick={() => setPlayerToPay(null)}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-[Cairo]">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-950 text-xs font-bold space-y-1">
            <div>اسم اللاعب: <span className="font-extrabold text-sm text-emerald-900">{playerToPay?.full_name}</span></div>
            <div>الشهر المراد سداده: <span className="font-extrabold text-sm text-emerald-700 font-tabular">{formatMonth(selectedMonth)}</span></div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">مبلغ الاشتراك (ج.م) *</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">طريقة الدفع *</label>
            <select
              value={payMethod}
              onChange={(e: any) => setPayMethod(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="cash">💵 نقدي (كاش)</option>
              <option value="transfer">🏦 تحويل بنكي / فودافون كاش</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Quick Branch Settle Modal */}
      <Modal
        isOpen={showBranchSettleModal}
        onClose={() => setShowBranchSettleModal(false)}
        title="🏢 تسديد شهر مالي لفرع محدد بنقرة واحدة"
      >
        <div className="space-y-4 font-[Cairo]">
          <p className="text-slate-600 text-xs font-semibold">
            اختر الفرع المراد تسديد جميع لاعبيه النشطين لشهر <strong className="text-emerald-700 font-tabular">{formatMonth(selectedMonth)}</strong> دفعة واحدة:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branches.map((b) => {
              const unpaidCountInB = playersList.filter((p) => p.branch_id === b.id && !p.is_paid).length;
              return (
                <button
                  key={b.id}
                  onClick={() => settleSpecificBranch(b.id, b.name)}
                  disabled={isBulkBranchSubmitting}
                  className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl text-right transition-all cursor-pointer group flex flex-col justify-between gap-2"
                >
                  <div className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-800 flex items-center justify-between">
                    <span>{b.name}</span>
                    <Building2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    غير المسددين: <span className="text-rose-600 font-tabular">{unpaidCountInB} لاعب</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

    </div>
  );
}
