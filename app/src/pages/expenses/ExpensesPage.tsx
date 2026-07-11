import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate, formatMoney } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import type { Expense, ExpenseCategory } from '../../lib/types';
import { EXPENSE_CATEGORY_LABELS } from '../../lib/types';
import { TrendingDown } from 'lucide-react';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';

export default function ExpensesPage() {
  const { branchFilter, branches } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    branch_id: '', category: 'other' as ExpenseCategory,
    amount: '', expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('expenses')
      .select('*, branches(name)')
      .order('expense_date', { ascending: false })
      .limit(100);
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q;
    const mapped = (data || []).map((e: Record<string, unknown>) => ({
      ...e,
      branch_name: (e.branches as Record<string, string>)?.name,
    })) as Expense[];
    setExpenses(mapped);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // ⚡ Realtime: auto-refresh when expenses changes
  useRealtimeRefresh(['expenses'], loadExpenses);

  async function deleteExpense(id: string) {
    if (!window.confirm('هل أنت متأكد من مسح هذا المصروف نهائياً؟')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      toast('error', 'حدث خطأ أثناء مسح المصروف');
      return;
    }
    toast('success', 'تم مسح المصروف بنجاح');
    loadExpenses();
  }

  async function saveExpense() {
    if (!form.branch_id || !form.amount || !form.category || !form.expense_date) {
      toast('error', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (!window.confirm('هل أنت متأكد من تسجيل هذا المصروف؟')) return;

    const { error } = await supabase.from('expenses').insert({
      branch_id: form.branch_id,
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      notes: form.notes || null,
      recorded_by: profile?.id,
    });
    if (error) { toast('error', 'خطأ في تسجيل المصروف'); return; }
    toast('success', 'تم تسجيل المصروف بنجاح');
    setShowForm(false);
    setForm({ branch_id: branchFilter || '', category: 'other', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
    loadExpenses();
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Group by category for summary
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <PageLoading />;

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-red-400">
          <div className="text-xs text-slate-500 mb-1">إجمالي المصروفات</div>
          <div className="text-xl font-extrabold text-red-600 tabular-nums">{formatMoney(totalExpenses)}</div>
        </div>
        {Object.entries(categoryTotals).slice(0, 3).map(([cat, total]) => (
          <div key={cat} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</div>
            <div className="text-lg font-bold text-slate-700 tabular-nums">{formatMoney(total)}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{expenses.length} مصروف</span>
        <button onClick={() => { setForm(f => ({ ...f, branch_id: branchFilter || '' })); setShowForm(true); }}
          className="py-2 px-4 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all cursor-pointer shadow-sm">
          + إضافة مصروف
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={<TrendingDown size={48} className="text-slate-300 mb-4" />} title="لا توجد مصروفات مسجلة" />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الفئة</th>
                  {!branchFilter && <th>الفرع</th>}
                  <th className="px-4">القيمة</th>
                  <th className="px-4 w-1/4 text-right">ملاحظات</th>
                  <th className="px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td className="text-sm">{formatDate(e.expense_date)}</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    {!branchFilter && <td><BranchBadge branchId={e.branch_id} branchName={e.branch_name || ''} /></td>}
                    <td className="tabular-data font-bold text-red-600">{formatMoney(e.amount)}</td>
                    <td className="text-xs text-slate-400 max-w-[200px] truncate">{e.notes || '—'}</td>
                    <td className="px-4 text-left">
                      <button onClick={() => deleteExpense(e.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="مسح المصروف">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="إضافة مصروف" footer={
        <>
          <button onClick={saveExpense} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">تسجيل</button>
          <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border-2 border-slate-200 rounded-lg text-sm font-bold cursor-pointer">إلغاء</button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">الفرع *</label>
            <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">الفئة</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">المبلغ *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">التاريخ</label>
            <input type="date" value={form.expense_date} onChange={(e) => setForm(f => ({ ...f, expense_date: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">ملاحظات</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none resize-none h-16" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
