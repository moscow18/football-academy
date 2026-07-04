import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { formatMoney, buildWhatsAppLink, debtReminderMessage, renewalReminderMessage, formatDate } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import type { DebtItem, Group } from '../../lib/types';

export default function PeriodicSubscriptionsPage() {
  const { branchFilter } = useBranch();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [birthYearFilter, setBirthYearFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const loadGroups = useCallback(async () => {
    let q = supabase.from('groups').select('*');
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q.order('name');
    setGroups(data || []);
  }, [branchFilter]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.rpc('rpc_debt_list', {
      p_branch_id: branchFilter || null,
    });
    setDebts((data as DebtItem[]) || []);
    setLoading(false);
    setInitialLoading(false);
  }

  useEffect(() => {
    loadData();
    loadGroups();
  }, [branchFilter, loadGroups]);

  // Filter only periodic (league) players (payment_type = 'quarterly')
  const leaguePlayers = debts.filter(d => d.payment_type === 'quarterly');

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

  // Calculate stats for filtered data
  const totalPaid = filteredData.reduce((s, d) => s + Number(d.total_paid || 0), 0);
  const totalDebt = filteredData.reduce((s, d) => s + (Number(d.debt) > 0 ? Number(d.debt) : 0), 0);
  const totalExpected = filteredData.reduce((s, d) => s + Number(d.total_expected || 0), 0);
  const debtorsCount = filteredData.filter(d => Number(d.debt) > 0).length;

  function exportToExcel() {
    const wsData = filteredData.map(d => ({
      'الكود': d.player_code,
      'الاسم': d.player_name,
      'المواليد': d.date_of_birth ? d.date_of_birth.substring(0, 4) : '—',
      'الفرع': d.branch_name,
      'المجموعة/الفريق': d.group_name || 'بدون مجموعة',
      'قيمة الاشتراك الدوري': d.fee_amount_periodic,
      'الأشهر المسجلة': d.months_enrolled,
      'إجمالي المتوقع': d.total_expected,
      'إجمالي المدفوع': d.total_paid,
      'المديونية': d.debt,
      'موعد التجديد': d.next_payment_date ? formatDate(d.next_payment_date) : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللاعبين الدوريين');
    XLSX.writeFile(wb, `league_players_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (initialLoading) return <PageLoading />;

  return (
    <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm flex flex-col gap-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
          <div className="bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
            <div className="text-xs text-emerald-700 font-bold mb-1 font-arabic">عدد لاعبي الدوري</div>
            <div className="text-xl font-extrabold text-emerald-700 tabular-nums">{filteredData.length} <span className="text-xs font-medium font-arabic">لاعب</span></div>
          </div>
          <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-700 font-bold mb-1 font-arabic">إجمالي المحصل للدوري</div>
            <div className="text-xl font-extrabold text-blue-700 tabular-nums">{formatMoney(totalPaid)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-amber-50 px-4 py-3 rounded-lg border border-amber-100">
            <div className="text-xs text-amber-700 font-bold mb-1 font-arabic">إجمالي المتوقع للدوري</div>
            <div className="text-xl font-extrabold text-amber-700 tabular-nums">{formatMoney(totalExpected)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
          </div>
          <div className="bg-red-50 px-4 py-3 rounded-lg border border-red-100">
            <div className="text-xs text-red-700 font-bold mb-1 font-arabic">المديونيات المتبقية</div>
            <div className="text-xl font-extrabold text-red-600 tabular-nums">{formatMoney(totalDebt)} <span className="text-xs font-medium font-arabic">ج.م</span></div>
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
              className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
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
              className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
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
              📊 تصدير Excel
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
                  <th>قيمة الاشتراك</th>
                  <th>أشهر الاشتراك</th>
                  <th>المتوقع</th>
                  <th>المدفوع</th>
                  <th>المديونية</th>
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
                    <td className="tabular-data text-center">{d.months_enrolled}</td>
                    <td className="tabular-data">{formatMoney(d.total_expected)}</td>
                    <td className="tabular-data text-emerald-600">{formatMoney(d.total_paid)}</td>
                    <td className={`tabular-data font-bold ${Number(d.debt) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {Number(d.debt) > 0 ? formatMoney(d.debt) : '0'}
                    </td>
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
    </div>
  );
}
