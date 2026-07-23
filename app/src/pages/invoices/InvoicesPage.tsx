import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate, formatMoney } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import type { Invoice } from '../../lib/types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Modal from '../../components/ui/Modal';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { FileText, Download } from 'lucide-react';

export default function InvoicesPage() {
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Invoice Number State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvoiceNumValue, setEditInvoiceNumValue] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('invoices')
      .select('*, players(full_name, player_code, phone, parent_phone), branches(name)')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data: invData } = await q;

    // ⚡ Auto-sync missing invoices from payments table (when user is logged in)
    let pq = supabase
      .from('payments')
      .select('id, player_id, branch_id, amount, payment_date, period_covered')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (branchFilter) pq = pq.eq('branch_id', branchFilter);
    const { data: payData } = await pq;

    if (payData && payData.length > 0) {
      const existingKeys = new Set(
        (invData || []).map((inv: any) => `${inv.player_id}_${inv.issued_date}_${inv.amount}`)
      );
      const missing = payData.filter(
        (p: any) => !existingKeys.has(`${p.player_id}_${p.payment_date}_${p.amount}`)
      );

      if (missing.length > 0) {
        const invoiceRows = missing.map((p: any, idx: number) => ({
          invoice_number: `INV-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          player_id: p.player_id,
          branch_id: p.branch_id,
          amount: p.amount,
          issued_date: p.payment_date || new Date().toISOString().split('T')[0],
          notes: `فاتورة سداد اشتراك شهر ${p.period_covered || ''}`,
        }));

        for (let i = 0; i < invoiceRows.length; i += 50) {
          await supabase.from('invoices').insert(invoiceRows.slice(i, i + 50));
        }

        const { data: refreshedInv } = await q;
        if (refreshedInv) {
          const mapped = refreshedInv.map((inv: Record<string, unknown>) => ({
            ...inv,
            player_name: (inv.players as Record<string, string>)?.full_name,
            player_code: (inv.players as Record<string, string>)?.player_code,
            player_phone: (inv.players as Record<string, string>)?.phone,
            player_parent_phone: (inv.players as Record<string, string>)?.parent_phone,
            branch_name: (inv.branches as Record<string, string>)?.name,
          })) as (Invoice & { player_phone?: string; player_parent_phone?: string; branch_name?: string })[];
          setInvoices(mapped);
          setLoading(false);
          return;
        }
      }
    }

    const mapped = (invData || []).map((inv: Record<string, unknown>) => ({
      ...inv,
      player_name: (inv.players as Record<string, string>)?.full_name,
      player_code: (inv.players as Record<string, string>)?.player_code,
      player_phone: (inv.players as Record<string, string>)?.phone,
      player_parent_phone: (inv.players as Record<string, string>)?.parent_phone,
      branch_name: (inv.branches as Record<string, string>)?.name,
    })) as (Invoice & { player_phone?: string; player_parent_phone?: string; branch_name?: string })[];
    setInvoices(mapped);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useRealtimeRefresh(['invoices'], loadInvoices);

  async function generatePDF(inv: Invoice) {
    const el = document.getElementById(`receipt-html-${inv.id}`);
    if (!el) return;

    toast('success', 'جاري تجهيز الفاتورة...');
    
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
      pdf.save(`invoice_${inv.invoice_number}.pdf`);
      toast('success', 'تم تحميل الفاتورة بنجاح ✅');
    } catch (err) {
      console.error(err);
      toast('error', `حدث خطأ: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const handleUpdateInvoiceNumber = async () => {
    if (!editingInvoice || !editInvoiceNumValue.trim()) {
      toast('error', 'يرجى إدخال رقم الإيصال الورقي');
      return;
    }

    const cleanNum = editInvoiceNumValue.trim();
    const { error } = await supabase
      .from('invoices')
      .update({ invoice_number: cleanNum })
      .eq('id', editingInvoice.id);

    if (error) {
      toast('error', `فشل تحديث رقم الإيصال: ${error.message}`);
      return;
    }

    toast('success', 'تم تعديل رقم الإيصال بنجاح ✅');
    setEditingInvoice(null);
    loadInvoices();
  };

  // Filter invoices by search
  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const playerName = (inv.player_name || '').toLowerCase();
    const playerCode = (inv.player_code || '').toLowerCase();
    const phone = ((inv as any).player_phone || '').toLowerCase();
    const parentPhone = ((inv as any).player_parent_phone || '').toLowerCase();
    const invNum = (inv.invoice_number || '').toLowerCase();
    return playerName.includes(q) || playerCode.includes(q) || phone.includes(q) || parentPhone.includes(q) || invNum.includes(q);
  });

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 animate-fade-in font-[Cairo] pb-12">

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            🧾 سجل الفواتير الرسمية
          </h1>
          <p className="text-slate-500 text-sm font-semibold mt-1">
            جميع الفواتير التي تم إنشاؤها تلقائياً عند تسديد الاشتراكات
          </p>
        </div>
        <div className="text-sm font-bold text-slate-500">
          إجمالي: <span className="text-emerald-700 font-extrabold font-tabular">{filteredInvoices.length}</span> فاتورة
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-blue-700 font-extrabold">إجمالي الفواتير</span>
            <FileText size={20} className="text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold text-blue-900 font-tabular">{invoices.length}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-2xs">
          <div className="text-xs text-emerald-700 font-extrabold mb-2">إجمالي المبالغ المفوترة</div>
          <div className="text-2xl font-extrabold text-emerald-900 font-tabular">{formatMoney(totalAmount)} <span className="text-xs">ج.م</span></div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 shadow-2xs">
          <div className="text-xs text-purple-700 font-extrabold mb-2">نتائج البحث</div>
          <div className="text-3xl font-extrabold text-purple-900 font-tabular">{filteredInvoices.length}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <input
          type="text"
          placeholder="🔍 بحث باسم اللاعب، كود اللاعب، رقم التليفون، أو رقم الفاتورة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full py-3 px-4 border border-slate-200 rounded-xl text-sm md:text-base bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors font-bold"
        />
      </div>

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState icon="🧾" title="لا توجد فواتير" subtitle={searchQuery ? 'لا توجد نتائج تطابق البحث' : 'سيتم إنشاء الفواتير تلقائياً عند تسجيل المدفوعات من صفحة السداد'} />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm">رقم الفاتورة</th>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm">اللاعب</th>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm hidden md:table-cell">الفرع</th>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm">المبلغ</th>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm hidden sm:table-cell">التاريخ</th>
                  <th className="px-5 md:px-6 py-4 text-slate-600 font-extrabold text-sm text-center">تحميل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 md:px-6 py-4 md:py-5 font-mono text-xs md:text-sm font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{inv.invoice_number}</span>
                        <button
                          onClick={() => {
                            setEditingInvoice(inv);
                            setEditInvoiceNumValue(inv.invoice_number);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل رقم الإيصال يدوياً"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5">
                      <div className="font-extrabold text-slate-900 text-sm md:text-base">{inv.player_name || '—'}</div>
                      <div className="text-[11px] text-slate-400 font-mono font-bold flex flex-wrap gap-2 mt-0.5">
                        <span>كود: {inv.player_code || '—'}</span>
                        {((inv as any).player_phone || (inv as any).player_parent_phone) && (
                          <span className="text-emerald-700 font-semibold">📱 {(inv as any).player_phone || (inv as any).player_parent_phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5 text-xs md:text-sm font-bold text-slate-500 hidden md:table-cell">
                      {(inv as any).branch_name || '—'}
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-extrabold text-emerald-700 text-sm md:text-base font-tabular">
                      {formatMoney(inv.amount)} <span className="text-[10px] text-slate-400">ج.م</span>
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5 text-xs md:text-sm font-bold text-slate-500 font-tabular hidden sm:table-cell">
                      {formatDate(inv.issued_date)}
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5 text-center">
                      <button
                        onClick={() => generatePDF(inv)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs md:text-sm font-extrabold hover:bg-blue-100 transition-all cursor-pointer border border-blue-200 flex items-center gap-1.5 mx-auto hover:scale-105 active:scale-95"
                      >
                        <Download size={16} />
                        طباعة PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Invoice Number Modal */}
      <Modal 
        isOpen={!!editingInvoice} 
        onClose={() => setEditingInvoice(null)} 
        title="تعديل رقم الإيصال / الفاتورة"
        footer={
          <div className="flex justify-end gap-2 w-full font-[Cairo]">
            <button 
              onClick={handleUpdateInvoiceNumber}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm"
            >
              حفظ رقم الإيصال
            </button>
            <button 
              onClick={() => setEditingInvoice(null)} 
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-[Cairo]">
          <p className="text-xs text-slate-500 font-bold">
            أدخل رقم الإيصال الورقي المطلوب لمراجعة الدفتر وتدقيق الفواتير:
          </p>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">رقم الإيصال الورقي / الدفتر *</label>
            <input 
              value={editInvoiceNumValue} 
              onChange={(e) => setEditInvoiceNumValue(e.target.value)} 
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-blue-500 focus:outline-none font-bold" 
              placeholder="مثال: 1045 أو REC-88" 
            />
          </div>
        </div>
      </Modal>

      {/* Hidden Templates for PDF Generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {filteredInvoices.map(inv => {
          const branch = branches.find(b => b.id === inv.branch_id);
          return (
            <div 
              key={inv.id} 
              id={`receipt-html-${inv.id}`} 
              className="p-8 w-[600px] font-[Cairo]" 
              dir="rtl"
              style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
            >
              <div className="flex justify-between items-center pb-6 mb-6" style={{ borderBottom: '3px solid #059669' }}>
                <div>
                  <h2 className="text-3xl font-black mb-1" style={{ color: '#065f46' }}>أكاديمية VFC</h2>
                  <p className="font-bold text-sm" style={{ color: '#64748b' }}>{branch?.name || 'الفرع الرئيسي'}</p>
                </div>
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center p-1" style={{ backgroundColor: '#0f172a', border: '2px solid #fbbf24' }}>
                  <img src="/logo.png" alt="VFC Official Logo" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="text-center mb-8 p-4 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h3 className="text-xl font-black mb-1" style={{ color: '#0f172a' }}>إيصال استلام نقدية رسمي</h3>
                <p className="font-mono text-xl font-bold" style={{ color: '#0284c7' }}>رقم الإيصال: #{inv.invoice_number}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>تاريخ الإصدار:</span>
                  <span className="font-bold">{formatDate(inv.issued_date)}</span>
                </div>
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>اسم اللاعب:</span>
                  <span className="font-extrabold text-lg">{inv.player_name || '—'}</span>
                </div>
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>كود اللاعب:</span>
                  <span className="font-mono font-bold" style={{ color: '#475569' }}>{inv.player_code || '—'}</span>
                </div>
                <div className="flex justify-between p-4 rounded-xl mt-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <span className="font-bold text-lg" style={{ color: '#065f46' }}>المبلغ المدفوع:</span>
                  <span className="font-extrabold text-2xl" style={{ color: '#059669' }}>{formatMoney(inv.amount)} ج.م</span>
                </div>
              </div>

              <div className="text-center mt-10 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
                <p className="text-sm font-bold mb-1" style={{ color: '#64748b' }}>شكراً لاختياركم أكاديمية VFC لكرة القدم ⚽</p>
                <p className="text-xs font-mono" style={{ color: '#94a3b8' }}>Printed on {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
