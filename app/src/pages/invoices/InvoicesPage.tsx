import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate, formatMoney } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import type { Invoice } from '../../lib/types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';

export default function InvoicesPage() {
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('invoices')
      .select('*, players(full_name, player_code), branches(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q;
    const mapped = (data || []).map((inv: Record<string, unknown>) => ({
      ...inv,
      player_name: (inv.players as Record<string, string>)?.full_name,
      player_code: (inv.players as Record<string, string>)?.player_code,
    })) as Invoice[];
    setInvoices(mapped);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // ⚡ Realtime: auto-refresh when invoices changes
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
      toast('success', 'تم تحميل الفاتورة بنجاح');
    } catch (err) {
      console.error(err);
      toast('error', `حدث خطأ: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div>
      <div className="text-sm text-slate-500 mb-4">
        إجمالي: <strong>{invoices.length}</strong> فاتورة
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon="🧾" title="لا توجد فواتير" subtitle="سيتم إنشاء الفواتير تلقائياً عند تسجيل المدفوعات" />
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>اللاعب</th>
                  <th>المبلغ</th>
                  <th>تاريخ الإصدار</th>
                  <th>تحميل</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs font-semibold text-slate-600">{inv.invoice_number}</td>
                    <td className="font-semibold">{inv.player_name} <span className="text-xs text-slate-400">({inv.player_code})</span></td>
                    <td className="tabular-data font-bold text-emerald-600">{formatMoney(inv.amount)}</td>
                    <td className="text-sm">{formatDate(inv.issued_date)}</td>
                    <td>
                      <button
                        onClick={() => generatePDF(inv)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                      >
                        📄 PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden Templates for PDF Generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {invoices.map(inv => {
          const branch = branches.find(b => b.id === inv.branch_id);
          return (
            <div 
              key={inv.id} 
              id={`receipt-html-${inv.id}`} 
              className="p-8 w-[600px] font-[Cairo]" 
              dir="rtl"
              style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
            >
              <div className="flex justify-between items-center pb-6 mb-6" style={{ borderBottom: '2px solid #059669' }}>
                <div>
                  <h2 className="text-3xl font-extrabold mb-1" style={{ color: '#065f46' }}>أكاديمية VFC</h2>
                  <p className="font-bold" style={{ color: '#64748b' }}>{branch?.name || 'الفرع الرئيسي'}</p>
                </div>
                <div className="text-center w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>
                  ⚽
                </div>
              </div>

              <div className="text-center mb-8 p-4 rounded-xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <h3 className="text-xl font-bold mb-2">فاتورة رسمية</h3>
                <p className="font-mono text-lg" style={{ color: '#64748b' }}>#{inv.invoice_number}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>تاريخ الإصدار:</span>
                  <span className="font-bold">{formatDate(inv.issued_date)}</span>
                </div>
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>اسم اللاعب:</span>
                  <span className="font-bold text-lg">{inv.player_name || '—'}</span>
                </div>
                <div className="flex justify-between p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <span className="font-semibold" style={{ color: '#64748b' }}>كود اللاعب:</span>
                  <span className="font-mono font-bold" style={{ color: '#475569' }}>{inv.player_code || '—'}</span>
                </div>
                <div className="flex justify-between p-4 rounded-lg mt-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #d1fae5' }}>
                  <span className="font-bold text-lg" style={{ color: '#065f46' }}>المبلغ المدفوع:</span>
                  <span className="font-bold text-2xl" style={{ color: '#059669' }}>{formatMoney(inv.amount)} ج.م</span>
                </div>
              </div>

              <div className="text-center mt-12 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#94a3b8' }}>شكراً لاختياركم أكاديمية VFC</p>
                <p className="text-xs font-mono" style={{ color: '#94a3b8' }}>Printed on {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
