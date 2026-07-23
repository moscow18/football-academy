import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatMonth, getCurrentMonth, formatDate, getActiveFinancialMonth } from '../../lib/utils';
import { PageLoading } from '../../components/ui/LoadingSpinner';
import { BranchBadge } from '../../components/ui/Badge';
import type { NetProfit, AttendanceSummary, LedgerTransaction } from '../../lib/types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { PieChart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import ProfitExplanationModal from '../../components/financial/ProfitExplanationModal';

type ReportType = 'monthly' | 'ledger' | 'attendance' | 'debts';

export default function ReportsPage() {
  const { branchFilter, selectedBranch } = useBranch();
  const { toast } = useToast();

  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [month, setMonth] = useState(getCurrentMonth());
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const [prevBranchId, setPrevBranchId] = useState<string | null>(null);

  useEffect(() => {
    const branchId = selectedBranch?.id || null;
    if (branchId !== prevBranchId) {
      setMonth(getActiveFinancialMonth(selectedBranch));
      setPrevBranchId(branchId);
    }
  }, [selectedBranch, prevBranchId]);

  // Report data
  const [profitData, setProfitData] = useState<NetProfit[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [debtData, setDebtData] = useState<Array<Record<string, unknown>>>([]);
  const [ledgerData, setLedgerData] = useState<LedgerTransaction[]>([]);

  useEffect(() => { loadReport(); }, [reportType, month, dateFrom, dateTo, branchFilter]);

  async function loadReport() {
    setLoading(true);
    try {
      if (reportType === 'monthly') {
        const { data } = await supabase.rpc('rpc_net_profit', {
          p_branch_id: branchFilter || null,
          p_month: month,
        });
        setProfitData((data as NetProfit[]) || []);
      } else if (reportType === 'ledger') {
        const { data } = await supabase.rpc('rpc_get_ledger', {
          p_branch_id: branchFilter || null,
          p_month: month,
        });
        setLedgerData((data as LedgerTransaction[]) || []);
      } else if (reportType === 'attendance') {
        const { data } = await supabase.rpc('rpc_attendance_summary', {
          p_branch_id: branchFilter || null,
          p_from: dateFrom,
          p_to: dateTo,
        });
        setAttendanceData((data as AttendanceSummary[]) || []);
      } else if (reportType === 'debts') {
        const { data } = await supabase.rpc('rpc_debt_list', {
          p_branch_id: branchFilter || null,
        });
        setDebtData((data || []).filter((d: any) => Number(d.debt) > 0));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');

    if (reportType === 'monthly') {
      doc.text('Monthly Financial Report - VFC Academy', 148, 15, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`Month: ${month}`, 148, 23, { align: 'center' });

      let y = 35;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const headers = ['Branch', 'Fee Revenue', 'Kit Revenue', 'Expenses', 'Salaries', 'Net Profit'];
      headers.forEach((h, i) => doc.text(h, 20 + i * 45, y));

      y += 8;
      doc.setFont('helvetica', 'normal');
      profitData.forEach(row => {
        doc.text(row.branch_name, 20, y);
        doc.text(String(row.fee_revenue), 65, y);
        doc.text(String(row.kit_revenue), 110, y);
        doc.text(String(row.total_expenses), 155, y);
        doc.text(String(row.salaries_paid), 200, y);
        doc.text(String(row.net_profit), 245, y);
        y += 7;
      });
    } else if (reportType === 'ledger') {
      doc.text('Cash Flow Ledger - VFC Academy', 148, 15, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`Month: ${month}`, 148, 23, { align: 'center' });

      let y = 35;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      ['Date', 'Branch', 'Type', 'Category', 'Amount', 'Person'].forEach((h, i) => doc.text(h, 20 + i * 40, y));

      y += 8;
      doc.setFont('helvetica', 'normal');
      ledgerData.forEach(row => {
        doc.text(row.transaction_date.split('T')[0], 20, y);
        doc.text(row.branch_name, 60, y);
        doc.text(row.transaction_type, 100, y);
        doc.text(row.category, 140, y);
        doc.text(String(row.amount), 180, y);
        doc.text(row.person_name || '-', 220, y);
        y += 7;
      });
    } else if (reportType === 'attendance') {
      doc.text('Attendance Report - VFC Academy', 148, 15, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`${dateFrom} to ${dateTo}`, 148, 23, { align: 'center' });

      let y = 35;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      ['Group', 'Sessions', 'Present', 'Absent', 'Late', 'Attendance %'].forEach((h, i) =>
        doc.text(h, 20 + i * 42, y));

      y += 8;
      doc.setFont('helvetica', 'normal');
      attendanceData.forEach(row => {
        doc.text(row.group_name, 20, y);
        doc.text(String(row.total_sessions), 62, y);
        doc.text(String(row.present_count), 104, y);
        doc.text(String(row.absent_count), 146, y);
        doc.text(String(row.late_count), 188, y);
        doc.text(`${row.attendance_pct}%`, 230, y);
        y += 7;
      });
    }

    doc.save(`report_${reportType}_${month || dateFrom}.pdf`);
    toast('success', 'تم تصدير التقرير PDF');
  }

  function exportExcel() {
    let wsData: Record<string, unknown>[] = [];

    if (reportType === 'monthly') {
      wsData = profitData.map(r => ({
        'الفرع': r.branch_name,
        'إيرادات الاشتراكات': Number(r.fee_revenue),
        'إيرادات الأطقم': Number(r.kit_revenue),
        'المصروفات': Number(r.total_expenses),
        'الرواتب': Number(r.salaries_paid),
        'صافي الربح': Number(r.net_profit),
      }));
    } else if (reportType === 'ledger') {
      wsData = ledgerData.map(r => ({
        'التاريخ': formatDate(r.transaction_date.split('T')[0]),
        'الفرع': r.branch_name,
        'النوع': r.transaction_type === 'income' ? 'إيراد' : 'مصروف',
        'التصنيف': r.category,
        'المبلغ': Number(r.amount),
        'الشخص': r.person_name || '—',
        'ملاحظات': r.notes || '—',
      }));
    } else if (reportType === 'attendance') {
      wsData = attendanceData.map(r => ({
        'المجموعة': r.group_name,
        'إجمالي الحصص': r.total_sessions,
        'حاضر': r.present_count,
        'غائب': r.absent_count,
        'متأخر': r.late_count,
        'نسبة الحضور': `${r.attendance_pct}%`,
      }));
    } else if (reportType === 'debts') {
      wsData = debtData.map(r => ({
        'اللاعب': r.player_name,
        'الكود': r.player_code,
        'الفرع': r.branch_name,
        'المجموعة': r.group_name,
        'المتوقع': r.total_expected,
        'المدفوع': r.total_paid,
        'المديونية': r.debt,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `report_${reportType}_${month || dateFrom}.xlsx`);
    toast('success', 'تم تصدير التقرير Excel');
  }

  const reportTypes: { id: ReportType; label: string }[] = [
    { id: 'monthly', label: '📊 مالي شهري' },
    { id: 'ledger', label: '📓 دفتر اليومية' },
    { id: 'attendance', label: '📋 الحضور' },
    { id: 'debts', label: '📌 الاشتراكات والمديونيات' },
  ];

  return (
    <div>
      {/* Report type tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1">
        {reportTypes.map(r => (
          <button key={r.id} onClick={() => setReportType(r.id)}
            className={`flex-1 py-2 px-3 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo]
              ${reportType === r.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        {(reportType === 'monthly' || reportType === 'ledger') && (
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">الشهر</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        )}
        {reportType === 'attendance' && (
          <>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">من</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">إلى</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="py-2 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          </>
        )}
        <div className="flex gap-2 mr-auto">
          <button onClick={exportPDF}
            className="py-2 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm cursor-pointer hover:bg-red-100 transition-colors">
            📄 تصدير PDF
          </button>
          <button onClick={exportExcel}
            className="py-2 px-4 bg-green-50 text-green-600 border border-green-200 rounded-lg font-bold text-sm cursor-pointer hover:bg-green-100 transition-colors">
            📊 تصدير Excel
          </button>
        </div>
      </div>

      {loading ? <PageLoading /> : (
        <div className="animate-fade-in">
          {/* Monthly Financial Report */}
          {reportType === 'monthly' && (
            <div className="space-y-5">
              <div className="premium-card overflow-hidden">
                <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-bold text-slate-800 font-arabic">التقرير المالي — {formatMonth(month)}</h4>
                  <button
                    onClick={() => setShowProfitModal(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer font-arabic hover:scale-105"
                  >
                    <PieChart size={15} className="text-emerald-400" />
                    <span>🔍 تفاصيل ودليل معادلة صافي الربح</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>الفرع</th>
                        <th>إيرادات الاشتراكات</th>
                        <th>إيرادات الأطقم</th>
                        <th>تكلفة الأطقم</th>
                        <th>المصروفات</th>
                        <th>الرواتب</th>
                        <th>صافي الربح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitData.map(r => (
                        <tr key={r.branch_id}>
                          <td><BranchBadge branchId={r.branch_id} branchName={r.branch_name} /></td>
                          <td className="tabular-data font-semibold text-emerald-600">{formatMoney(r.fee_revenue)}</td>
                          <td className="tabular-data">{formatMoney(r.kit_revenue)}</td>
                          <td className="tabular-data text-slate-500">{formatMoney(r.kit_cost)}</td>
                          <td className="tabular-data text-red-500">{formatMoney(r.total_expenses)}</td>
                          <td className="tabular-data text-red-500">{formatMoney(r.salaries_paid)}</td>
                          <td className={`tabular-nums font-bold ${Number(r.net_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatMoney(r.net_profit)}
                          </td>
                        </tr>
                      ))}
                      {profitData.length > 1 && (
                        <tr className="bg-slate-50 font-bold">
                          <td>الإجمالي</td>
                          <td className="tabular-data text-emerald-600">{formatMoney(profitData.reduce((s, r) => s + Number(r.fee_revenue), 0))}</td>
                          <td className="tabular-data">{formatMoney(profitData.reduce((s, r) => s + Number(r.kit_revenue), 0))}</td>
                          <td className="tabular-data text-slate-500">{formatMoney(profitData.reduce((s, r) => s + Number(r.kit_cost), 0))}</td>
                          <td className="tabular-data text-red-500">{formatMoney(profitData.reduce((s, r) => s + Number(r.total_expenses), 0))}</td>
                          <td className="tabular-data text-red-500">{formatMoney(profitData.reduce((s, r) => s + Number(r.salaries_paid), 0))}</td>
                          <td className="tabular-data">{formatMoney(profitData.reduce((s, r) => s + Number(r.net_profit), 0))}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Revenue vs Expenses Chart */}
              {profitData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <h4 className="font-bold text-slate-800 mb-4">📊 الإيرادات مقابل المصروفات</h4>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profitData.map(r => ({
                        name: r.branch_name,
                        revenue: Number(r.fee_revenue) + Number(r.kit_revenue),
                        expenses: Number(r.total_expenses) + Number(r.salaries_paid),
                        profit: Number(r.net_profit),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontFamily: 'Cairo', fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ fontFamily: 'Cairo', borderRadius: 8 }}
                          formatter={(v: any) => [formatMoney(v) + ' ج.م', '']} />
                        <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                        <Bar dataKey="revenue" name="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" name="الربح" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ledger Report */}
          {reportType === 'ledger' && (
            <div className="premium-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white flex justify-between items-center">
                <h4 className="font-bold text-slate-800">دفتر اليومية (Cash Flow) — {formatMonth(month)}</h4>
                <div className="flex gap-4">
                  <div className="text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-full text-sm">
                    إجمالي الدخل: {formatMoney(ledgerData.filter(t => t.transaction_type === 'income').reduce((s, t) => s + Number(t.amount), 0))} ج.م
                  </div>
                  <div className="text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full text-sm">
                    إجمالي المنصرف: {formatMoney(ledgerData.filter(t => t.transaction_type === 'outcome').reduce((s, t) => s + Number(t.amount), 0))} ج.م
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الفرع</th>
                      <th>النوع</th>
                      <th>التصنيف</th>
                      <th>المبلغ</th>
                      <th>الاسم</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.map(r => (
                      <tr key={r.transaction_id}>
                        <td className="tabular-data font-medium">{formatDate(r.transaction_date.split('T')[0])}</td>
                        <td>{r.branch_name}</td>
                        <td>
                          {r.transaction_type === 'income' ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full text-xs font-bold">إيراد</span>
                          ) : (
                            <span className="text-red-700 bg-red-50 px-2 py-1 rounded-full text-xs font-bold">مصروف</span>
                          )}
                        </td>
                        <td className="text-sm text-slate-500 font-semibold">{r.category}</td>
                        <td className={`tabular-nums font-bold ${r.transaction_type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r.transaction_type === 'income' ? '+' : '-'}{formatMoney(r.amount)}
                        </td>
                        <td className="font-bold">{r.person_name || '—'}</td>
                        <td className="text-slate-500 text-sm">{r.notes || '—'}</td>
                      </tr>
                    ))}
                    {ledgerData.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-8">لا توجد حركات مالية مسجلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance Report */}
          {reportType === 'attendance' && (
            <div className="premium-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white">
                <h4 className="font-bold text-slate-800">تقرير الحضور — {formatDate(dateFrom)} إلى {formatDate(dateTo)}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr><th>المجموعة</th><th>الحصص</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>نسبة الحضور</th></tr>
                  </thead>
                  <tbody>
                    {attendanceData.map(r => (
                      <tr key={r.group_id}>
                        <td className="font-semibold">{r.group_name}</td>
                        <td className="tabular-data">{r.total_sessions}</td>
                        <td className="tabular-data text-emerald-600">{r.present_count}</td>
                        <td className="tabular-data text-red-500">{r.absent_count}</td>
                        <td className="tabular-data text-amber-600">{r.late_count}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.attendance_pct}%` }} />
                            </div>
                            <span className="text-sm font-bold tabular-nums">{r.attendance_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {attendanceData.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-slate-400 py-8">لا توجد بيانات حضور في هذه الفترة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Debts Report */}
          {reportType === 'debts' && (
            <div className="premium-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white flex justify-between items-center">
                <h4 className="font-bold text-slate-800">تقرير الاشتراكات والمديونيات</h4>
                <span className="text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full text-sm">
                  الإجمالي: {formatMoney(debtData.reduce((s, d) => s + Number(d.debt || 0), 0))} ج.م
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr><th>اللاعب</th><th>الكود</th><th>الفرع</th><th>المتوقع</th><th>المدفوع</th><th>المديونية</th></tr>
                  </thead>
                  <tbody>
                    {debtData.map((d, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{String(d.player_name)}</td>
                        <td className="font-mono text-xs text-slate-500">{String(d.player_code)}</td>
                        <td>{Boolean(d.branch_id) && <BranchBadge branchId={String(d.branch_id)} branchName={String(d.branch_name)} />}</td>
                        <td className="tabular-data">{formatMoney(Number(d.total_expected))}</td>
                        <td className="tabular-data text-emerald-600">{formatMoney(Number(d.total_paid))}</td>
                        <td className="tabular-data font-bold text-red-600">{formatMoney(Number(d.debt))}</td>
                      </tr>
                    ))}
                    {debtData.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-slate-400 py-8">لا توجد مديونيات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Profit Explanation Modal */}
      <ProfitExplanationModal
        isOpen={showProfitModal}
        onClose={() => setShowProfitModal(false)}
        month={month}
        profitData={profitData}
        branchName={selectedBranch?.name || 'جميع الفروع'}
      />
    </div>
  );
}
