import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate, formatMoney, getCurrentMonth } from '../../lib/utils';
import { BranchBadge } from '../../components/ui/Badge';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { Payment, Player } from '../../lib/types';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Users, X, Search, Trash2 } from 'lucide-react';

const PAGE_SIZE = 50;

interface BulkPaymentPlayer {
  id: string;
  full_name: string;
  player_code: string;
  branch_id: string;
  fee_amount: number;
  amount: string; // editable amount per player
}

export default function PaymentsPage() {
  const { branchFilter } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchPlayer, setSearchPlayer] = useState('');
  const [debouncedSearchPlayer, setDebouncedSearchPlayer] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryIdRef = useRef(0);

  // Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    variant: 'danger',
    onConfirm: () => {},
  });

  // Add payment modal
  const [showForm, setShowForm] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [form, setForm] = useState<{
    player_id: string; branch_id: string; amount: string; method: 'cash' | 'transfer';
    period_covered: string; notes: string;
  }>({
    player_id: '', branch_id: '', amount: '', method: 'cash',
    period_covered: getCurrentMonth(), notes: '',
  });

  // Bulk payment modal
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkPlayers, setBulkPlayers] = useState<BulkPaymentPlayer[]>([]);
  const [bulkSearchResults, setBulkSearchResults] = useState<Player[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkMethod, setBulkMethod] = useState<'cash' | 'transfer'>('cash');
  const [bulkPeriod, setBulkPeriod] = useState(getCurrentMonth());
  const [bulkNotes, setBulkNotes] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const loadPayments = useCallback(async () => {
    const queryId = ++queryIdRef.current;
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('payments')
      .select('*, players(full_name, player_code), branches(name)', { count: 'exact' })
      .order('payment_date', { ascending: false })
      .range(from, to);

    if (branchFilter) q = q.eq('branch_id', branchFilter);
    if (debouncedSearchPlayer) q = q.or(`players.full_name.ilike.%${debouncedSearchPlayer}%`);

    const { data, count } = await q;
    if (queryId !== queryIdRef.current) return;

    const mapped = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      player_name: (p.players as Record<string, string>)?.full_name,
      player_code: (p.players as Record<string, string>)?.player_code,
      branch_name: (p.branches as Record<string, string>)?.name,
    })) as unknown as Payment[];

    setPayments(mapped);
    setTotal(count || 0);
    setLoading(false);
    setInitialLoading(false);
  }, [page, branchFilter, debouncedSearchPlayer]);

  // Debounce search player
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPlayer(searchPlayer);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchPlayer]);

  // Reset page when search or branch changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchPlayer, branchFilter]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // ⚡ Realtime: auto-refresh when payments change
  useRealtimeRefresh(['payments'], loadPayments);

  // Search players for payment form
  useEffect(() => {
    if (!showForm || !playerSearch) { setPlayers([]); return; }
    const timer = setTimeout(async () => {
      let q = supabase.from('players').select('id, full_name, player_code, branch_id, fee_amount').eq('status', 'active');
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      q = q.or(`full_name.ilike.%${playerSearch}%,player_code.ilike.%${playerSearch}%`).limit(10);
      const { data } = await q;
      setPlayers(data as Player[] || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch, showForm, branchFilter]);

  // Bulk payment search
  useEffect(() => {
    if (!showBulkForm || !bulkSearch) { setBulkSearchResults([]); return; }
    const timer = setTimeout(async () => {
      let q = supabase.from('players').select('id, full_name, player_code, branch_id, fee_amount').eq('status', 'active');
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      q = q.or(`full_name.ilike.%${bulkSearch}%,player_code.ilike.%${bulkSearch}%`).limit(10);
      const { data } = await q;
      // Filter out already added players
      const addedIds = new Set(bulkPlayers.map(p => p.id));
      setBulkSearchResults((data as Player[] || []).filter(p => !addedIds.has(p.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [bulkSearch, showBulkForm, branchFilter, bulkPlayers]);

  function addBulkPlayer(p: Player) {
    setBulkPlayers(prev => [...prev, {
      id: p.id,
      full_name: p.full_name,
      player_code: p.player_code,
      branch_id: p.branch_id,
      fee_amount: p.fee_amount,
      amount: String(p.fee_amount),
    }]);
    setBulkSearch('');
    setBulkSearchResults([]);
  }

  function removeBulkPlayer(id: string) {
    setBulkPlayers(prev => prev.filter(p => p.id !== id));
  }

  function updateBulkPlayerAmount(id: string, amount: string) {
    setBulkPlayers(prev => prev.map(p => p.id === id ? { ...p, amount } : p));
  }

  async function savePayment() {
    if (isSaving) return;
    if (!form.player_id || !form.amount) {
      toast('error', 'يرجى اختيار لاعب وإدخال المبلغ');
      return;
    }
    if (!window.confirm('هل أنت متأكد من تسجيل هذه الدفعة؟')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('payments').insert({
        player_id: form.player_id,
        branch_id: form.branch_id || branchFilter,
        amount: Number(form.amount),
        method: form.method,
        period_covered: form.period_covered,
        notes: form.notes || null,
        recorded_by: profile?.id,
      });

      if (error) { 
        toast('error', 'خطأ في تسجيل الدفعة'); 
        setIsSaving(false);
        return; 
      }

      // Also create an invoice
      await supabase.from('invoices').insert({
        player_id: form.player_id,
        branch_id: form.branch_id || branchFilter,
        amount: Number(form.amount),
      });

      toast('success', 'تم تسجيل الدفعة بنجاح');
      setShowForm(false);
      setForm({ player_id: '', branch_id: '', amount: '', method: 'cash', period_covered: getCurrentMonth(), notes: '' });
      setPlayerSearch('');
      loadPayments();
    } finally {
      setIsSaving(false);
    }
  }

  async function saveBulkPayments() {
    if (isBulkSaving) return;
    if (bulkPlayers.length === 0) {
      toast('error', 'يرجى إضافة لاعب واحد على الأقل');
      return;
    }
    const invalidPlayers = bulkPlayers.filter(p => !p.amount || Number(p.amount) <= 0);
    if (invalidPlayers.length > 0) {
      toast('error', `يرجى إدخال مبلغ صحيح لكل اللاعبين`);
      return;
    }
    if (!window.confirm(`هل أنت متأكد من تسجيل ${bulkPlayers.length} دفعة؟`)) return;

    setIsBulkSaving(true);
    try {
      // Insert all payments
      const paymentRows = bulkPlayers.map(p => ({
        player_id: p.id,
        branch_id: p.branch_id || branchFilter,
        amount: Number(p.amount),
        method: bulkMethod,
        period_covered: bulkPeriod,
        notes: bulkNotes || null,
        recorded_by: profile?.id,
      }));

      const { error } = await supabase.from('payments').insert(paymentRows);
      if (error) {
        toast('error', 'حدث خطأ في تسجيل الدفعات');
        console.error(error);
        return;
      }

      // Also create invoices for all
      const invoiceRows = bulkPlayers.map(p => ({
        player_id: p.id,
        branch_id: p.branch_id || branchFilter,
        amount: Number(p.amount),
      }));
      await supabase.from('invoices').insert(invoiceRows);

      toast('success', `تم تسجيل ${bulkPlayers.length} دفعة بنجاح ✅`);
      setShowBulkForm(false);
      setBulkPlayers([]);
      setBulkSearch('');
      setBulkMethod('cash');
      setBulkPeriod(getCurrentMonth());
      setBulkNotes('');
      loadPayments();
    } finally {
      setIsBulkSaving(false);
    }
  }

  async function printReceipt(p: Payment) {
    const el = document.getElementById(`payment-receipt-html-${p.id}`);
    if (!el) return;

    toast('success', 'جاري تجهيز الإيصال...');

    try {
      const canvas = await html2canvas(el, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
      
      const pdfWidth = pdf.internal.pageSize.width || (pdf.internal.pageSize.getWidth && pdf.internal.pageSize.getWidth()) || 148;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt_${p.player_code}_${p.payment_date}.pdf`);
      toast('success', 'تم تحميل الإيصال بنجاح');
    } catch (err) {
      console.error(err);
      toast('error', `حدث خطأ: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleDeletePayment(p: Payment) {
    setConfirmConfig({
      isOpen: true,
      title: 'إلغاء الدفعة أو استرجاع المبلغ للاعب 💸',
      message: `هل أنت متأكد من إلغاء وحذف هذه الدفعة بقيمة (${formatMoney(p.amount)} ج.م) للاعب (${p.player_name})؟\n\nإذا قام اللاعب باسترجاع فلوسه أو تم تسجيل الدفعة بالخطأ، سيتم حذف الدفعة وتعديل المديونية تلقائياً.`,
      confirmText: 'نعم، استرجاع المبلغ وإلغاء الدفعة 🗑️',
      cancelText: 'إلغاء',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('payments').delete().eq('id', p.id);
          if (error) {
            toast('error', 'حدث خطأ أثناء إلغاء الدفعة: ' + error.message);
            return;
          }
          toast('success', `تم إلغاء الدفعة واسترجاع المبلغ للاعب (${p.player_name}) بنجاح 🗑️`);
          loadPayments();
        } catch (err) {
          console.error(err);
          toast('error', 'حدث خطأ أثناء إلغاء الدفعة');
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchPlayer}
            onChange={(e) => setSearchPlayer(e.target.value)}
            placeholder="بحث بالاسم..."
            className="w-full py-2 px-4 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm bg-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button onClick={() => setShowForm(true)} className="py-2 px-4 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all cursor-pointer shadow-sm">
          + تسجيل دفعة
        </button>
        <button onClick={() => setShowBulkForm(true)} className="py-2 px-4 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all cursor-pointer shadow-sm flex items-center gap-2">
          <Users size={16} />
          تسديد جماعي
        </button>
      </div>

      <div className="text-sm text-slate-500 mb-3">
        إجمالي: <strong>{total.toLocaleString('ar-EG')}</strong> دفعة
      </div>

      {initialLoading ? (
        <PageLoading />
      ) : (
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
          {payments.length === 0 ? (
            <EmptyState icon="💰" title="لا توجد مدفوعات" />
          ) : (
            <div className="premium-card overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"></div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="premium-table">
              <thead>
                <tr>
                  <th>اللاعب</th>
                  <th>الكود</th>
                  {!branchFilter && <th>الفرع</th>}
                  <th>المبلغ</th>
                  <th>الطريقة</th>
                  <th>الفترة</th>
                  <th>التاريخ</th>
                  <th>ملاحظات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.player_name}</td>
                    <td className="font-mono text-xs text-slate-500">{p.player_code}</td>
                    {!branchFilter && <td><BranchBadge branchId={p.branch_id} branchName={(p as unknown as { branch_name: string }).branch_name || ''} /></td>}
                    <td className="tabular-data font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                    <td className="text-sm">{p.method === 'cash' ? '💵 نقدي' : '🏦 تحويل'}</td>
                    <td className="text-sm text-slate-500">{p.period_covered || '—'}</td>
                    <td className="text-sm">{formatDate(p.payment_date)}</td>
                    <td className="text-xs text-slate-400 max-w-[150px] truncate">{p.notes || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => printReceipt(p)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded transition-colors cursor-pointer"
                          title="طباعة إيصال"
                        >
                          <FileText size={16} />
                        </button>
                        {(profile?.role === 'owner' || profile?.role === 'admin') && (
                          <button 
                            onClick={() => handleDeletePayment(p)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded transition-colors cursor-pointer"
                            title="إلغاء / حذف الدفعة"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-100">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-40 cursor-pointer">→ السابق</button>
              <span className="text-sm text-slate-500">صفحة {page + 1} من {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-40 cursor-pointer">التالي ←</button>
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* Add Payment Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="تسجيل دفعة جديدة" footer={
        <>
          <button onClick={savePayment} disabled={isSaving} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer">
            {isSaving ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
          </button>
          <button onClick={() => setShowForm(false)} disabled={isSaving} className="px-5 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm disabled:opacity-50 cursor-pointer">إلغاء</button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">بحث عن اللاعب *</label>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="اكتب اسم أو كود اللاعب..."
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none"
            />
            {players.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setForm(f => ({ ...f, player_id: p.id, branch_id: p.branch_id, amount: String(p.fee_amount) }));
                      setPlayerSearch(`${p.full_name} (${p.player_code})`);
                      setPlayers([]);
                    }}
                    className={`w-full text-right px-3 py-2 text-sm hover:bg-emerald-50 transition-colors border-none cursor-pointer font-[Cairo] ${form.player_id === p.id ? 'bg-emerald-50' : 'bg-white'}`}
                  >
                    {p.full_name} <span className="text-slate-400 text-xs">({p.player_code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">المبلغ (ج.م) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">طريقة الدفع</label>
              <select value={form.method} onChange={(e) => setForm(f => ({ ...f, method: e.target.value as 'cash' | 'transfer' }))}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
                <option value="cash">نقدي</option>
                <option value="transfer">تحويل</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">الفترة</label>
            <input type="month" value={form.period_covered} onChange={(e) => setForm(f => ({ ...f, period_covered: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">ملاحظات</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none resize-none h-16" />
          </div>
        </div>
      </Modal>

      {/* Bulk Payment Modal */}
      <Modal isOpen={showBulkForm} onClose={() => setShowBulkForm(false)} title="تسديد جماعي" size="xl" footer={
        <>
          <button onClick={saveBulkPayments} disabled={isBulkSaving || bulkPlayers.length === 0} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2">
            <Users size={16} />
            {isBulkSaving ? 'جاري التسديد...' : `تسديد ${bulkPlayers.length} لاعب`}
          </button>
          <button onClick={() => setShowBulkForm(false)} disabled={isBulkSaving} className="px-5 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm disabled:opacity-50 cursor-pointer">إلغاء</button>
        </>
      }>
        <div className="space-y-5">
          {/* Shared settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">طريقة الدفع</label>
              <select value={bulkMethod} onChange={(e) => setBulkMethod(e.target.value as 'cash' | 'transfer')}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-blue-500 focus:outline-none bg-white">
                <option value="cash">💵 نقدي</option>
                <option value="transfer">🏦 تحويل</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">الفترة</label>
              <input type="month" value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-blue-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">ملاحظات (اختياري)</label>
              <input type="text" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="ملاحظات مشتركة..."
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-blue-500 focus:outline-none bg-white" />
            </div>
          </div>

          {/* Search and add players */}
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">بحث وإضافة لاعبين</label>
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
                placeholder="اكتب اسم أو كود اللاعب لإضافته..."
                className="w-full py-2.5 pr-10 pl-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {bulkSearchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                {bulkSearchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addBulkPlayer(p)}
                    className="w-full text-right px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors border-none cursor-pointer font-[Cairo] bg-white flex items-center justify-between"
                  >
                    <span>{p.full_name} <span className="text-slate-400 text-xs">({p.player_code})</span></span>
                    <span className="text-blue-600 text-xs font-bold">+ إضافة</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Players list */}
          {bulkPlayers.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-slate-700">
                  اللاعبين المضافين ({bulkPlayers.length})
                </div>
                <div className="text-sm font-bold text-blue-600">
                  الإجمالي: {formatMoney(bulkPlayers.reduce((s, p) => s + (Number(p.amount) || 0), 0))} ج.م
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-bold text-slate-500">اللاعب</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-slate-500">الكود</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-slate-500 w-32">المبلغ (ج.م)</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-slate-500 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkPlayers.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{p.full_name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.player_code}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={p.amount}
                            onChange={(e) => updateBulkPlayerAmount(p.id, e.target.value)}
                            className="w-full py-1.5 px-2 border border-slate-200 rounded-md font-[Cairo] text-sm focus:border-blue-500 focus:outline-none tabular-nums text-center"
                            dir="ltr"
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => removeBulkPlayer(p.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer bg-transparent border-none"
                            title="إزالة"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-semibold">ابحث عن لاعبين وأضفهم للقائمة</p>
              <p className="text-xs mt-1">يمكنك تعديل المبلغ لكل لاعب على حدة</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Hidden Templates for PDF Generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {payments.map(p => (
          <div 
            key={p.id} 
            id={`payment-receipt-html-${p.id}`} 
            className="p-8 w-[500px] font-[Cairo]" 
            dir="rtl"
            style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
          >
            <div className="flex justify-between items-center pb-6 mb-6" style={{ borderBottom: '2px solid #059669' }}>
              <div>
                <h2 className="text-3xl font-extrabold mb-1" style={{ color: '#065f46' }}>أكاديمية VFC</h2>
                <p className="font-bold" style={{ color: '#64748b' }}>إيصال استلام نقدية</p>
              </div>
              <div className="text-center w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>
                ⚽
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="font-semibold" style={{ color: '#64748b' }}>تاريخ الدفع:</span>
                <span className="font-bold">{formatDate(p.payment_date)}</span>
              </div>
              <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="font-semibold" style={{ color: '#64748b' }}>اسم اللاعب:</span>
                <span className="font-bold text-lg">{p.player_name || '—'}</span>
              </div>
              <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="font-semibold" style={{ color: '#64748b' }}>كود اللاعب:</span>
                <span className="font-mono font-bold" style={{ color: '#475569' }}>{p.player_code || '—'}</span>
              </div>
              <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="font-semibold" style={{ color: '#64748b' }}>الفترة:</span>
                <span className="font-bold">{p.period_covered || '—'}</span>
              </div>
              <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <span className="font-semibold" style={{ color: '#64748b' }}>طريقة الدفع:</span>
                <span className="font-bold">{p.method === 'cash' ? 'نقدي' : 'تحويل'}</span>
              </div>
              <div className="flex justify-between p-4 rounded-lg mt-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #d1fae5' }}>
                <span className="font-bold text-lg" style={{ color: '#065f46' }}>المبلغ المدفوع:</span>
                <span className="font-bold text-2xl" style={{ color: '#059669' }}>{formatMoney(p.amount)} ج.م</span>
              </div>
            </div>

            <div className="text-center mt-12 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#94a3b8' }}>شكراً لاختياركم أكاديمية VFC</p>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
      />
    </div>
  );
}
