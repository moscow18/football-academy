import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate, formatMoney } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { Expense, ExpenseCategory } from '../../lib/types';
import { EXPENSE_CATEGORY_LABELS } from '../../lib/types';
import { TrendingDown, Edit2, Trash2, Plus } from 'lucide-react';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';

export default function ExpensesPage() {
  const { branchFilter, branches } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [form, setForm] = useState({
    branch_id: '',
    category: 'other' as ExpenseCategory,
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('expenses')
      .select('*, branches(name)')
      .order('expense_date', { ascending: false })
      .limit(200);
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
  useRealtimeRefresh(['expenses'], loadExpenses);

  function openAddForm() {
    setEditingExpense(null);
    setForm({
      branch_id: branchFilter || branches[0]?.id || '',
      category: 'other',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowForm(true);
  }

  function openEditForm(exp: Expense) {
    setEditingExpense(exp);
    setForm({
      branch_id: exp.branch_id,
      category: exp.category,
      amount: String(exp.amount),
      expense_date: exp.expense_date || new Date().toISOString().split('T')[0],
      notes: exp.notes || '',
    });
    setShowForm(true);
  }

  async function confirmDeleteExpense() {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete.id);
      if (error) {
        toast('error', `حدث خطأ أثناء مسح المصروف: ${error.message}`);
        return;
      }
      toast('success', 'تم مسح المصروف بنجاح ✅');
      setExpenseToDelete(null);
      loadExpenses();
    } finally {
      setIsDeleting(false);
    }
  }

  async function saveExpense() {
    if (!form.branch_id || !form.amount || !form.category || !form.expense_date) {
      toast('error', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const numAmount = Number(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast('error', 'يرجى إدخال مبلغ مصروف صحيح');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        branch_id: form.branch_id,
        category: form.category,
        amount: numAmount,
        expense_date: form.expense_date,
        notes: form.notes || null,
        recorded_by: profile?.id || null,
      };

      if (editingExpense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
        if (error) { toast('error', `خطأ في تعديل المصروف: ${error.message}`); return; }
        toast('success', 'تم تعديل بيانات المصروف بنجاح ✅');
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) { toast('error', `خطأ في تسجيل المصروف: ${error.message}`); return; }
        toast('success', 'تم تسجيل المصروف بنجاح ✅');
      }

      setShowForm(false);
      setEditingExpense(null);
      setForm({ branch_id: branchFilter || '', category: 'other', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
      loadExpenses();
    } finally {
      setIsSaving(false);
    }
  }

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (searchQuery && !e.notes?.includes(searchQuery) && !EXPENSE_CATEGORY_LABELS[e.category]?.includes(searchQuery)) return false;
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // Group by category for summary
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 animate-fade-in font-[Cairo] pb-12">

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            💸 إدار المصروفات والنفقات التشغيلية
          </h1>
          <p className="text-slate-500 text-sm font-semibold mt-1">
            تسجيل وتتبع جميع المصروفات الإيجارية، المرافق، الأطقم، والأدوات الرياضية
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>تسجيل مصروف جديد</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-rose-700 font-extrabold">إجمالي المصروفات المعروضة</span>
            <TrendingDown size={20} className="text-rose-600" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-rose-900 font-tabular">
            {formatMoney(totalExpenses)} <span className="text-xs font-bold">ج.م</span>
          </div>
        </div>

        {Object.entries(EXPENSE_CATEGORY_LABELS).slice(0, 3).map(([catKey, catLabel]) => (
          <div key={catKey} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="text-xs text-slate-500 font-bold mb-2">{catLabel}</div>
            <div className="text-xl font-extrabold text-slate-800 font-tabular">
              {formatMoney(categoryTotals[catKey] || 0)} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              categoryFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({expenses.length})
          </button>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(k)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                categoryFilter === k ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="🔍 بحث بملاحظات المصروف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-4 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-rose-500 focus:bg-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Table Section */}
      {filteredExpenses.length === 0 ? (
        <EmptyState icon={<TrendingDown size={48} className="text-slate-300 mb-4" />} title="لا توجد مصروفات مسجلة" subtitle="لم يتم العثور على مصروفات تطابق الفلتر المختار" />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">التاريخ</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">فئة المصروف</th>
                  {!branchFilter && <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">الفرع</th>}
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">المبلغ (ج.م)</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm">ملاحظات والتفاصيل</th>
                  <th className="px-5 py-3.5 text-slate-600 font-bold text-xs md:text-sm text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 text-xs md:text-sm font-bold text-slate-700 font-tabular">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                      </span>
                    </td>
                    {!branchFilter && (
                      <td className="px-5 py-4">
                        <BranchBadge branchId={e.branch_id} branchName={e.branch_name || ''} />
                      </td>
                    )}
                    <td className="px-5 py-4 font-extrabold text-rose-700 text-sm font-tabular">
                      {formatMoney(e.amount)} <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 font-medium max-w-xs truncate">
                      {e.notes || '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditForm(e)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setExpenseToDelete(e)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="مسح"
                        >
                          <Trash2 size={16} />
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

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingExpense ? "✏️ تعديل بيانات المصروف" : "➕ تسجيل مصروف جديد"}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={saveExpense}
              disabled={isSaving}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-sm cursor-pointer transition-all shadow-sm"
            >
              {isSaving ? '⏳ جاري الحفظ...' : editingExpense ? 'حفظ التعديلات ✅' : 'تسجيل المصروف ✅'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              disabled={isSaving}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">الفرع *</label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:outline-none cursor-pointer"
            >
              <option value="">اختر الفرع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الفئة *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:outline-none cursor-pointer"
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:outline-none font-tabular"
                dir="ltr"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">التاريخ *</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:outline-none font-tabular"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات والتفاصيل</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:outline-none resize-none h-20"
              placeholder="اكتب ملاحظات تفصيلية..."
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Expense Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="تأكيد مسح المصروف"
        message={`هل أنت متأكد من مسح المصروف بقيمة (${formatMoney(expenseToDelete?.amount || 0)} ج.م) نهائياً؟\nسيتم حذف السجل من الحسابات والميزانية ولا يمكن التراجع.`}
        confirmText="نعم، احذف المصروف"
        cancelText="إلغاء"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
