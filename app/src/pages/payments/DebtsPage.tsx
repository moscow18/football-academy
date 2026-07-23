import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, buildWhatsAppLink, debtReminderMessage, renewalReminderMessage, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import type { DebtItem } from '../../lib/types';
import { ShieldCheck, RotateCcw } from 'lucide-react';

export default function DebtsPage() {
  const { branchFilter } = useBranch();
  const { toast } = useToast();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showDebtsOnly, setShowDebtsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Single player debt waiver modal
  const [selectedPlayerForWaive, setSelectedPlayerForWaive] = useState<DebtItem | null>(null);
  const [waiveReason, setWaiveReason] = useState('عدم حضور / غياب خلال الشهر');
  const [waiveAmount, setWaiveAmount] = useState('');
  const [freezePlayer, setFreezePlayer] = useState(false);
  const [waiveNotes, setWaiveNotes] = useState('');
  const [isSubmittingWaive, setIsSubmittingWaive] = useState(false);

  const loadDebts = useCallback(async () => {
    if (initialLoading) setLoading(true);
    const { data } = await supabase.rpc('rpc_debt_list', {
      p_branch_id: branchFilter || null,
    });
    setDebts((data as DebtItem[]) || []);
    setLoading(false);
    setInitialLoading(false);
  }, [branchFilter]);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  // ⚡ Realtime: auto-refresh when players or payments change
  useRealtimeRefresh(['players', 'payments'], loadDebts);

  // Filter to monthly players only (exclude league/periodic-only players)
  const monthlyPlayers = debts.filter(d => Number(d.fee_amount) > 0);

  const filteredData = monthlyPlayers.filter(d => {
    if (showDebtsOnly && Number(d.debt_monthly) <= 0) return false;
    if (searchQuery && !d.player_name.includes(searchQuery) && !d.player_code.includes(searchQuery)) return false;
    return true;
  });

  // Stats — MONTHLY ONLY (no league data)
  const totalExpectedMonthly = monthlyPlayers.reduce((s, d) => s + Number(d.total_expected_monthly || 0), 0);
  const totalPaidMonthly = monthlyPlayers.reduce((s, d) => s + Number(d.total_paid || 0), 0);
  const totalDebtMonthly = monthlyPlayers.reduce((s, d) => s + (Number(d.debt_monthly) > 0 ? Number(d.debt_monthly) : 0), 0);
  const debtorsCount = monthlyPlayers.filter(d => Number(d.debt_monthly) > 0).length;

  const openWaiveModal = (player: DebtItem) => {
    setSelectedPlayerForWaive(player);
    setWaiveReason('عدم حضور / غياب خلال الشهر');
    setWaiveAmount(String(Number(player.debt_monthly) || 0));
    setFreezePlayer(false);
    setWaiveNotes(`خصم وإعفاء مديونية لعدم الحضور بناءً على طلب الإدارة`);
  };

  const handleWaivePlayerDebt = async () => {
    if (!selectedPlayerForWaive) return;
    const amountNum = parseFloat(waiveAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast('error', 'يرجى إدخال مبلغ إعفاء أو خصم صحيح');
      return;
    }

    setIsSubmittingWaive(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // 1. Insert settlement payment record
      const { error: pErr } = await supabase.from('payments').insert({
        player_id: selectedPlayerForWaive.player_id,
        branch_id: selectedPlayerForWaive.branch_id,
        amount: amountNum,
        payment_date: todayStr,
        method: 'cash',
        period_covered: `تسوية وإعفاء: ${waiveReason}`,
        notes: waiveNotes || `إعفاء مديونية للاعب ${selectedPlayerForWaive.player_name}`
      });

      if (pErr) throw pErr;

      // 2. If freeze player is checked, update status to suspended
      if (freezePlayer) {
        const { error: statusErr } = await supabase
          .from('players')
          .update({ status: 'suspended' })
          .eq('id', selectedPlayerForWaive.player_id);
        
        if (statusErr) console.error('Error freezing player:', statusErr);
      }

      toast('success', `تم تسوية وإعفاء مديونية اللاعب (${selectedPlayerForWaive.player_name}) بنجاح!`);
      setSelectedPlayerForWaive(null);
      loadDebts();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء التسوية: ' + err.message);
    } finally {
      setIsSubmittingWaive(false);
    }
  };

  const rollbackBulkSettlement = async () => {
    if (!confirm('هل أنت متأكد من إلغاء وحذف كافة دفعات "تسوية الشهور القديمة" التي تم تسجيلها آلياً بالخطأ اليوم؟\n\nسيتم استعادة المديونيات الحقيقية لجميع اللاعبين فوراً.')) return;

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .or('notes.ilike.%تصفية الشهور القديمة%,notes.ilike.%تسوية الشهور القديمة%');

      if (error) throw error;

      toast('success', 'تم التراجع عن التسوية التلقائية وحذف جميع الدفعات المسجلة بالخطأ بنجاح! 🗑️');
      loadDebts();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء التراجع: ' + err.message);
    }
  };

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      
      {/* Help Banner for Debt Explanation */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-5 mb-5 shadow-sm font-arabic animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
            💡
          </div>
          <div className="flex-1 text-sm text-slate-700 leading-relaxed space-y-2">
            <h3 className="font-bold text-base text-blue-950">نظام تحصيل الاشتراكات والتعامل مع اللاعبين الغائبين:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-white/80 p-3 rounded-xl border border-blue-100 font-medium">
              <div>📌 <strong className="text-emerald-700">1. الشهر بشهره:</strong> يتم استحقاق الاشتراك شهرياً لكل لاعب منتظم في التدريبات.</div>
              <div>📌 <strong className="text-amber-700">2. لاعب لم يحضر شهر كامل؟</strong> اضغط زر <strong>"إعفاء غياب / تسوية"</strong> بجانب اسم اللاعب لخصم مديونية الشهر غير المحضور.</div>
              <div>📌 <strong className="text-blue-700">3. تجميد الاشتراك:</strong> عند تجميد حساب اللاعب (تغيير حالته إلى "موقوف")، يتم إيقاف احتساب الشهور التالية عليه آلياً.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary — MONTHLY ONLY */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm flex flex-col gap-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
            <div className="text-xs text-emerald-700 font-bold mb-1 font-arabic">إجمالي المتوقع (شهري فقط)</div>
            <div className="text-xl font-extrabold text-emerald-700 tabular-nums">{formatMoney(totalExpectedMonthly)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-700 font-bold mb-1 font-arabic">إجمالي المحصل</div>
            <div className="text-xl font-extrabold text-blue-700 tabular-nums">{formatMoney(totalPaidMonthly)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-red-50 px-4 py-3 rounded-lg border border-red-100">
            <div className="text-xs text-red-700 font-bold mb-1 font-arabic">إجمالي المديونيات (شهري)</div>
            <div className="text-xl font-extrabold text-red-600 tabular-nums">{formatMoney(totalDebtMonthly)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-5 justify-between items-center pt-3 border-t border-slate-100">
          <div className="flex flex-col gap-1 w-full md:w-auto font-arabic">
            <div className="text-sm font-semibold text-slate-700">إجمالي اللاعبين: <span className="font-bold text-slate-900">{monthlyPlayers.length}</span></div>
            <div className="text-sm font-semibold text-slate-700">اللاعبين بمديونية: <span className="font-bold text-red-600">{debtorsCount}</span></div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={rollbackBulkSettlement}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer font-arabic"
              title="إلغاء وحذف كافة الدفعات المسجلة بالخطأ عند الضغط على تسوية الجميع"
            >
              <RotateCcw size={15} />
              <span>تراجع عن تسوية الجميع بالخطأ</span>
            </button>
            <input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 md:w-64 py-2 px-4 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
            />
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
              <input type="checkbox" checked={showDebtsOnly} onChange={(e) => setShowDebtsOnly(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              إظهار المديونيات فقط
            </label>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <EmptyState icon="✅" title="لا توجد نتائج" subtitle="لم يتم العثور على لاعبين يطابقون بحثك" />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>اللاعب</th>
                  <th>الكود</th>
                  {!branchFilter && <th>الفرع</th>}
                  <th>المجموعة</th>
                  <th>الاشتراك الشهري</th>
                  <th>الأشهر</th>
                  <th>المتوقع (شهري)</th>
                  <th>المدفوع</th>
                  <th>المديونية (شهري)</th>
                  <th>آخر دفعة</th>
                  <th>موعد التجديد</th>
                  <th>إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(d => (
                  <tr key={d.player_id}>
                    <td className="font-semibold">{d.player_name}</td>
                    <td className="font-mono text-xs text-slate-500">{d.player_code}</td>
                    {!branchFilter && <td><BranchBadge branchId={d.branch_id} branchName={d.branch_name} /></td>}
                    <td className="text-slate-600 text-sm">{d.group_name || '—'}</td>
                    <td className="tabular-data font-bold text-slate-800">{formatMoney(d.fee_amount)} <span className="text-[10px] text-slate-400 font-medium font-arabic">شهري</span></td>
                    <td className="tabular-data text-center">{d.months_enrolled}</td>
                    <td className="tabular-data">{formatMoney(d.total_expected_monthly)}</td>
                    <td className="tabular-data text-emerald-600">{formatMoney(d.total_paid)}</td>
                    <td className={`tabular-data font-bold ${Number(d.debt_monthly) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {Number(d.debt_monthly) > 0 ? formatMoney(d.debt_monthly) : '0'}
                    </td>
                    <td className="text-sm font-medium">{formatDate(d.last_payment_date)}</td>
                    <td className="text-sm font-bold text-slate-800">{formatDate(d.next_payment_date)}</td>
                    <td>
                      <div className="flex gap-2 items-center flex-wrap">
                        {Number(d.debt_monthly) > 0 && (
                          <button
                            onClick={() => openWaiveModal(d)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                            title="تسوية أو إعفاء مديونية لاعب غائب"
                          >
                            <ShieldCheck size={14} /> إعفاء غياب / تسوية
                          </button>
                        )}
                        {Number(d.debt_monthly) > 0 && (d.parent_phone || d.phone) && (
                          <a
                            href={buildWhatsAppLink(d.parent_phone || d.phone || '', debtReminderMessage(d.player_name, Number(d.debt_monthly), d.next_payment_date))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors no-underline whitespace-nowrap"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors no-underline whitespace-nowrap"
                            title="تذكير بموعد التجديد القادم"
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

      {/* Modal: Single Player Debt Exemption / Settlement */}
      <Modal
        isOpen={!!selectedPlayerForWaive}
        onClose={() => setSelectedPlayerForWaive(null)}
        title="🛡️ تسوية وإعفاء مديونية لاعب غائب"
        footer={
          <div className="flex gap-2 justify-end font-[Cairo]">
            <button
              onClick={handleWaivePlayerDebt}
              disabled={isSubmittingWaive}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingWaive ? 'جاري تنفيذ الإعفاء...' : 'حفظ وتسوية الإعفاء'}
            </button>
            <button
              onClick={() => setSelectedPlayerForWaive(null)}
              className="px-5 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-[Cairo]">
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs font-bold space-y-1">
            <div>اللاعب: <span className="text-amber-950 font-extrabold text-sm">{selectedPlayerForWaive?.player_name}</span></div>
            <div>المديونية الحالية المسجلة: <span className="text-red-600 font-extrabold text-sm font-tabular">{formatMoney(selectedPlayerForWaive?.debt_monthly || 0)} ج.م</span></div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">سبب الإعفاء أو الخصم *</label>
            <select
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-amber-500 focus:outline-none"
            >
              <option value="عدم حضور / غياب خلال الشهر">عدم حضور / غياب خلال الشهر</option>
              <option value="خصم خاص بناءً على طلب ولي الأمر والمدير">خصم خاص بناءً على طلب ولي الأمر والمدير</option>
              <option value="تسوية مستحقات قديمة">تسوية مستحقات قديمة</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">مبلغ الإعفاء / الخصم المراد تنفيذه (ج.م) *</label>
            <input
              type="number"
              value={waiveAmount}
              onChange={(e) => setWaiveAmount(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-amber-500 focus:outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات والتفاصيل</label>
            <input
              type="text"
              value={waiveNotes}
              onChange={(e) => setWaiveNotes(e.target.value)}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-amber-500 focus:outline-none"
              placeholder="مثال: خصم شهر يونيو لعدم الحضور"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
            <input
              type="checkbox"
              id="freezePlayerChk"
              checked={freezePlayer}
              onChange={(e) => setFreezePlayer(e.target.checked)}
              className="w-5 h-5 accent-amber-600 cursor-pointer"
            />
            <label htmlFor="freezePlayerChk" className="text-xs font-bold text-slate-800 cursor-pointer">
              تجميد حساب اللاعب (تغيير حالته إلى "موقوف") حتى لا تُحسب عليه الشهور القادمة.
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
