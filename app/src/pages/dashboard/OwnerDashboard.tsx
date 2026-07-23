import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMonth, getActiveFinancialMonth } from '../../lib/utils';
import { Users, TrendingUp, TrendingDown, Activity, PieChart } from 'lucide-react';
import { PageLoading } from '../../components/ui/LoadingSpinner';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import ProfitExplanationModal from '../../components/financial/ProfitExplanationModal';
import KPIAnalyticsModal, { type KPIType } from '../../components/financial/KPIAnalyticsModal';
import type { NetProfit } from '../../lib/types';

interface DashboardStats {
  activePlayers: number;
  totalDebt: number;
  totalCollectedMonthly: number;
  totalCollectedPeriodic: number;
  totalKitsSales: number;
  expensesAndSalaries: number;
  netProfit: number;
  revenueTrend: any[];
  recentPlayers: any[];
}

export default function OwnerDashboard() {
  const { selectedBranchId, selectedBranch } = useBranch();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profitData, setProfitData] = useState<NetProfit[]>([]);
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [activeKpiModal, setActiveKpiModal] = useState<KPIType | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => 
    getActiveFinancialMonth(selectedBranch)
  );

  const [prevBranchId, setPrevBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBranchId !== prevBranchId) {
      setSelectedMonth(getActiveFinancialMonth(selectedBranch));
      setPrevBranchId(selectedBranchId);
    }
  }, [selectedBranchId, selectedBranch, prevBranchId]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const branchFilter = selectedBranchId ? selectedBranchId : null;

      const startOfMonth = `${selectedMonth}-01`;
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${selectedMonth}-${lastDay < 10 ? '0' + lastDay : lastDay}`;

      let playersQuery = supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'active');
      if (branchFilter) playersQuery = playersQuery.eq('branch_id', branchFilter);

      let payQuery = supabase
        .from('payments')
        .select('amount, notes, player_id, branch_id, period_covered, players(payment_type, fee_amount_periodic)')
        .eq('period_covered', selectedMonth);
      if (branchFilter) payQuery = payQuery.eq('branch_id', branchFilter);

      let kitQuery = supabase
        .from('kits_sales')
        .select('total_amount, branch_id')
        .gte('created_at', `${startOfMonth}T00:00:00`)
        .lte('created_at', `${endOfMonth}T23:59:59`);
      if (branchFilter) kitQuery = kitQuery.eq('branch_id', branchFilter);

      const [
        { count: playersCount },
        { data: branchData },
        { data: trendData },
        { data: recentPlayersData },
        { data: rawProfitData },
        { data: monthPayments },
        { data: monthKits }
      ] = await Promise.all([
        playersQuery,
        supabase.rpc('get_monthly_branch_stats', { p_month: selectedMonth }),
        supabase.rpc('get_revenue_trend', { p_branch_id: branchFilter }),
        supabase
          .from('players')
          .select('id, full_name, branch_id, status, created_at, branches(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.rpc('rpc_net_profit', { p_branch_id: branchFilter, p_month: selectedMonth }),
        payQuery,
        kitQuery
      ]);

      setProfitData((rawProfitData as NetProfit[]) || []);
      let activePlayers = playersCount || 0;

      let branchBreakdown = branchData || [];
      if (branchFilter) {
        branchBreakdown = branchBreakdown.filter((b: any) => b.branch_id === branchFilter);
      }

      const totalExpensesAndSalaries = branchBreakdown.reduce(
        (sum: number, b: any) => sum + Number(b.total_expenses || 0) + Number(b.salaries_paid || 0),
        0
      );
      
      const { data: debtListData } = await supabase.rpc('rpc_debt_list', { p_branch_id: branchFilter });
      const totalDebt = debtListData ? debtListData.reduce((sum: number, d: any) => sum + (Number(d.debt) > 0 ? Number(d.debt) : 0), 0) : 0;

      // ⚡ CALCULATE REAL ACCURATE MONETARY TOTALS FROM DB
      let totalCollectedMonthly = 0;
      let totalCollectedPeriodic = 0;

      (monthPayments || []).forEach((p: any) => {
        const playerObj = Array.isArray(p.players) ? p.players[0] : p.players;
        const notes = String(p.notes || '').toLowerCase();
        const isLeague = 
          playerObj?.payment_type === 'quarterly' || 
          Number(playerObj?.fee_amount_periodic || 0) > 0 ||
          notes.includes('دوري') ||
          notes.includes('الدوري');

        if (isLeague) {
          totalCollectedPeriodic += Number(p.amount || 0);
        } else {
          totalCollectedMonthly += Number(p.amount || 0);
        }
      });

      const totalKitsSales = (monthKits || []).reduce((sum: number, k: any) => sum + Number(k.total_amount || 0), 0);
      // ⚡ NET PROFIT = Monthly Subscriptions + Kit Sales - Expenses/Salaries
      // ❌ League (periodic) payments are EXCLUDED because they pay quarterly (every 3 months), not monthly
      const netProfit = (totalCollectedMonthly + totalKitsSales) - totalExpensesAndSalaries;

      let recent = recentPlayersData || [];
      if (branchFilter) {
        recent = recent.filter(p => p.branch_id === branchFilter);
      }

      setStats({
        activePlayers,
        totalDebt,
        totalCollectedMonthly,
        totalCollectedPeriodic,
        totalKitsSales,
        expensesAndSalaries: totalExpensesAndSalaries,
        netProfit,
        revenueTrend: trendData || [],
        recentPlayers: recent,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    setLoading(false);
  }, [selectedBranchId, selectedMonth]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ⚡ Realtime: auto-refresh when data changes
  useRealtimeRefresh(['players', 'payments', 'expenses'], loadDashboard);

  if (loading || !stats) return <PageLoading />;

  const chartData = transformTrendData(stats.revenueTrend);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Header Section */}
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1 font-arabic">نظرة عامة على أداء الأكاديمية</h2>
          <p className="text-slate-500 font-medium text-sm font-arabic">التحليل المالي والإحصائيات الخاصة باللاعبين.</p>
        </div>
        
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowProfitModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-slate-900 to-emerald-950 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer font-arabic hover:scale-105"
          >
            <PieChart size={16} className="text-emerald-400" />
            <span>🔍 تفاصيل حساب صافي الربح والشرح</span>
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm">
            <span className="text-slate-500 font-bold text-sm font-arabic">الشهر المالي:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-transparent font-tabular font-bold text-slate-700 focus:outline-none cursor-pointer focus:ring-0 text-sm font-[Cairo]"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Active Players */}
        <div 
          onClick={() => setActiveKpiModal('players')}
          className="bg-white border border-slate-200 border-r-4 border-r-emerald-700 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-emerald-700 transition-colors">اللاعبين النشطين</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-emerald-800 font-tabular">
              {stats.activePlayers.toLocaleString('en-US')}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-arabic">إجمالي المشتركين حالياً</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 font-arabic">
              🔍 تفاصيل اللاعبين
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div 
          onClick={() => setShowProfitModal(true)}
          className="bg-white border border-slate-200 border-r-4 border-r-emerald-700 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-emerald-700 transition-colors">صافي الربح ({formatMonth(selectedMonth)})</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-emerald-800 font-tabular">
              {stats.netProfit.toLocaleString('en-US')}
            </h3>
            <span className="text-sm font-bold text-emerald-700 font-arabic">ج.م</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-arabic">
              اشتراكات شهرية + أطقم − مصروفات (بدون الدوري)
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 font-arabic">
              🔍 تفاصيل المعادلة
            </span>
          </div>
        </div>

        {/* Monthly Subscriptions */}
        <div 
          onClick={() => setActiveKpiModal('monthly_sub')}
          className="bg-white border border-slate-200 border-r-4 border-r-emerald-700 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-emerald-700 transition-colors">الاشتراكات الشهرية</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-emerald-800 font-tabular">
              {stats.totalCollectedMonthly.toLocaleString('en-US')}
            </h3>
            <span className="text-sm font-bold text-emerald-700 font-arabic">ج.م</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-arabic">اشتراكات شهرية فقط</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 font-arabic">
              🔍 التفاصيل
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Periodic (League) Subscriptions */}
        <div 
          onClick={() => setActiveKpiModal('league_sub')}
          className="bg-white border border-slate-200 border-r-4 border-r-blue-600 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-blue-700 transition-colors">اشتراكات الدوري (ربع سنوي)</span>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-blue-800 font-tabular">
              {stats.totalCollectedPeriodic.toLocaleString('en-US')}
            </h3>
            <span className="text-sm font-bold text-blue-700 font-arabic">ج.م</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-orange-500 font-arabic">⚠️ لا يُحسب في صافي الربح الشهري (كل 3 شهور)</span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1 font-arabic">
              🔍 تفاصيل الدوري
            </span>
          </div>
        </div>

        {/* Kits & Apparel Sales */}
        <div 
          onClick={() => setActiveKpiModal('kits')}
          className="bg-white border border-slate-200 border-r-4 border-r-purple-600 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-purple-700 transition-colors">مبيعات الأطقم واللبس</span>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              👕
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-purple-800 font-tabular">
              {stats.totalKitsSales.toLocaleString('en-US')}
            </h3>
            <span className="text-sm font-bold text-purple-700 font-arabic">ج.م</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-arabic">إجمالي مبيعات أطقم الأكاديمية</span>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1 font-arabic">
              🔍 تحليل الأطقم
            </span>
          </div>
        </div>

        {/* Expenses and Salaries */}
        <div 
          onClick={() => setActiveKpiModal('expenses_salaries')}
          className="bg-white border border-slate-200 border-r-4 border-r-rose-600 p-6 flex flex-col justify-between rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 font-bold text-sm font-arabic tracking-wide group-hover:text-rose-700 transition-colors">المرتبات والمصروفات</span>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <TrendingDown size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-extrabold text-rose-800 font-tabular">
              {stats.expensesAndSalaries.toLocaleString('en-US')}
            </h3>
            <span className="text-sm font-bold text-rose-700 font-arabic">ج.م</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-arabic">إجمالي المصروفات والرواتب</span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1 font-arabic">
              🔍 تفاصيل الخصومات
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Table: Recent Activity */}
        <div className="bg-white rounded-xl flex flex-col overflow-hidden shadow-sm border border-slate-200">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Activity size={16} />
            </div>
            <h4 className="text-lg font-bold text-slate-800 font-arabic">أحدث التسجيلات</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">اسم اللاعب</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الفرع</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm text-center font-arabic">تاريخ التسجيل</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm text-center font-arabic">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-slate-400 font-bold text-sm font-arabic">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <span>لا يوجد لاعبين مسجلين بعد. ابدأ بإضافة أول لاعب.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stats.recentPlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 font-arabic flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                          {p.full_name.charAt(0)}
                        </div>
                        {p.full_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 font-arabic">
                          {p.branches?.name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-tabular text-slate-500 text-sm font-bold">
                        {new Date(p.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          p.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {p.status === 'active' ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart: Revenue Trend (Owner Only) */}
        {profile?.role === 'owner' && (
          <div className="bg-white rounded-xl flex flex-col overflow-hidden shadow-sm border border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <TrendingUp size={16} />
              </div>
              <h4 className="text-lg font-bold text-slate-800 font-arabic">نمو الإيرادات (6 أشهر)</h4>
            </div>
            <div className="p-6 flex-1 min-h-[300px]">
              {chartData.length === 0 || chartData.every(d => d.total === 0) ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-lg p-6 font-arabic text-center">
                  <TrendingUp size={32} className="text-slate-300 mb-3" strokeWidth={1.5} />
                  <p>لم يتم تسجيل إيرادات بعد.</p>
                  <p className="text-slate-400 text-xs mt-1">ستظهر البيانات المالية هنا تلقائياً عند إضافة مدفوعات.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toLocaleString('en-US')} ج.م`, 'الإيرادات']}
                      labelFormatter={(label) => formatMonth(label)}
                      contentStyle={{ fontFamily: 'inherit', textAlign: 'right', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => {
                        const [, m] = val.split('-');
                        const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return names[parseInt(m) - 1] || val;
                      }}
                      tick={{ fontSize: 13, fill: '#64748b', fontFamily: 'var(--font-arabic)', fontWeight: 600 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 13, fill: '#64748b', fontFamily: 'var(--font-tabular)', fontWeight: 600 }} 
                      tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                      dx={-10}
                    />
                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Financial Profit Explanation Modal */}
      <ProfitExplanationModal
        isOpen={showProfitModal}
        onClose={() => setShowProfitModal(false)}
        month={selectedMonth}
        profitData={profitData}
        branchName={selectedBranch?.name || 'جميع الفروع'}
      />

      {/* Generic KPI Analytics Modal */}
      <KPIAnalyticsModal
        isOpen={!!activeKpiModal}
        onClose={() => setActiveKpiModal(null)}
        kpiType={activeKpiModal}
        month={selectedMonth}
        branchName={selectedBranch?.name || 'جميع الفروع'}
        data={{
          activePlayersCount: stats.activePlayers,
          monthlyRevenue: stats.totalCollectedMonthly,
          leagueRevenue: stats.totalCollectedPeriodic,
          kitsRevenue: stats.totalKitsSales,
          totalExpenses: profitData.reduce((s, r) => s + Number(r.total_expenses || 0), 0),
          totalSalaries: profitData.reduce((s, r) => s + Number(r.salaries_paid || 0), 0),
          recentPlayers: stats.recentPlayers,
        }}
      />
    </div>
  );
}

function transformTrendData(raw: any[]) {
  if (!raw || raw.length === 0) return [];
  
  const monthMap = new Map<string, Record<string, number>>();

  for (const item of raw) {
    if (!monthMap.has(item.month)) {
      monthMap.set(item.month, { month: item.month as unknown as number } as Record<string, number>);
    }
    const entry = monthMap.get(item.month)!;
    // Safely parse revenue and add to total
    const rev = Number(item.revenue || 0);
    entry.total = (entry.total || 0) + rev;
  }

  return Array.from(monthMap.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)));
}
