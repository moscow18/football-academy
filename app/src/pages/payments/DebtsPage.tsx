import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { formatMoney, buildWhatsAppLink, debtReminderMessage, renewalReminderMessage, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import type { DebtItem } from '../../lib/types';

export default function DebtsPage() {
  const { branchFilter } = useBranch();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showDebtsOnly, setShowDebtsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDebts();
  }, [branchFilter]);

  async function loadDebts() {
    setLoading(true);
    const { data } = await supabase.rpc('rpc_debt_list', {
      p_branch_id: branchFilter || null,
    });
    setDebts((data as DebtItem[]) || []);
    setLoading(false);
    setInitialLoading(false);
  }

  const filteredData = debts.filter(d => {
    if (showDebtsOnly && Number(d.debt) <= 0) return false;
    if (searchQuery && !d.player_name.includes(searchQuery) && !d.player_code.includes(searchQuery)) return false;
    return true;
  });

  const totalPaidMonthly = debts
    .filter(d => d.payment_type === 'monthly')
    .reduce((s, d) => s + Number(d.total_paid || 0), 0);

  const totalPaidPeriodic = debts
    .filter(d => d.payment_type === 'quarterly')
    .reduce((s, d) => s + Number(d.total_paid || 0), 0);

  const totalDebt = debts.reduce((s, d) => s + (Number(d.debt) > 0 ? Number(d.debt) : 0), 0);
  const debtorsCount = debts.filter(d => Number(d.debt) > 0).length;

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm flex flex-col gap-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
            <div className="text-xs text-emerald-700 font-bold mb-1 font-arabic">إجمالي المحصل (اشتراكات شهرية)</div>
            <div className="text-xl font-extrabold text-emerald-700 tabular-nums">{formatMoney(totalPaidMonthly)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-700 font-bold mb-1 font-arabic">إجمالي المحصل (اشتراكات دورية)</div>
            <div className="text-xl font-extrabold text-blue-700 tabular-nums">{formatMoney(totalPaidPeriodic)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-red-50 px-4 py-3 rounded-lg border border-red-100">
            <div className="text-xs text-red-700 font-bold mb-1 font-arabic">إجمالي المديونيات المتبقية</div>
            <div className="text-xl font-extrabold text-red-600 tabular-nums">{formatMoney(totalDebt)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-5 justify-between items-center pt-3 border-t border-slate-100">
          <div className="flex flex-col gap-1 w-full md:w-auto font-arabic">
            <div className="text-sm font-semibold text-slate-700">إجمالي اللاعبين النشطين: <span className="font-bold text-slate-900">{debts.length}</span></div>
            <div className="text-sm font-semibold text-slate-700">اللاعبين بمديونية: <span className="font-bold text-red-600">{debtorsCount}</span></div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                  <th>الاشتراك الحالي</th>
                  <th>الأشهر</th>
                  <th>المتوقع</th>
                  <th>المدفوع</th>
                  <th>المديونية</th>
                  <th>آخر دفعة</th>
                  <th>موعد التجديد</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(d => (
                  <tr key={d.player_id}>
                    <td className="font-semibold">{d.player_name}</td>
                    <td className="font-mono text-xs text-slate-500">{d.player_code}</td>
                    {!branchFilter && <td><BranchBadge branchId={d.branch_id} branchName={d.branch_name} /></td>}
                    <td className="text-slate-600 text-sm">{d.group_name || '—'}</td>
                    <td className="tabular-data">
                      {d.payment_type === 'quarterly' ? (
                        <span className="text-emerald-700 font-bold font-tabular">{formatMoney(d.fee_amount_periodic)} <span className="text-[10px] text-emerald-500 font-medium font-arabic">دوري</span></span>
                      ) : (
                        <span className="text-slate-800 font-bold font-tabular">{formatMoney(d.fee_amount)} <span className="text-[10px] text-slate-400 font-medium font-arabic">شهري</span></span>
                      )}
                    </td>
                    <td className="tabular-data text-center">{d.months_enrolled}</td>
                    <td className="tabular-data">{formatMoney(d.total_expected)}</td>
                    <td className="tabular-data text-emerald-600">{formatMoney(d.total_paid)}</td>
                    <td className={`tabular-data font-bold ${Number(d.debt) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {Number(d.debt) > 0 ? formatMoney(d.debt) : '0'}
                    </td>
                    <td className="text-sm font-medium">{formatDate(d.last_payment_date)}</td>
                    <td className="text-sm font-bold text-slate-800">{formatDate(d.next_payment_date)}</td>
                    <td>
                      <div className="flex gap-2 items-center flex-wrap">
                        {Number(d.debt) > 0 && (d.parent_phone || d.phone) && (
                          <a
                            href={buildWhatsAppLink(d.parent_phone || d.phone || '', debtReminderMessage(d.player_name, Number(d.debt), d.next_payment_date))}
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
    </div>
  );
}
