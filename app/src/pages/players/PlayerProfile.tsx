import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatDate, formatMoney, calculateAge, buildWhatsAppLink, debtReminderMessage } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/LoadingSpinner';
import type { Player, Payment, Attendance, KitPurchase } from '../../lib/types';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [kitPurchases, setKitPurchases] = useState<KitPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'attendance' | 'payments' | 'kits'>('info');

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);

    // Player with group/branch join
    const { data: pData } = await supabase
      .from('players')
      .select('*, groups(name), branches(name)')
      .eq('id', id!)
      .single();

    if (pData) {
      setPlayer({
        ...pData,
        group_name: (pData.groups as Record<string, string>)?.name,
        branch_name: (pData.branches as Record<string, string>)?.name,
      } as Player);
    }

    // Payments
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('player_id', id!)
      .order('payment_date', { ascending: false })
      .limit(50);
    setPayments(payData || []);

    // Attendance (last 30 records)
    const { data: attData } = await supabase
      .from('attendance')
      .select('*')
      .eq('player_id', id!)
      .order('session_date', { ascending: false })
      .limit(30);
    setAttendance(attData || []);

    // Kit purchases
    const { data: kitData } = await supabase
      .from('kit_purchases')
      .select('*, kit_items(item_name)')
      .eq('player_id', id!)
      .order('purchase_date', { ascending: false })
      .limit(20);
    setKitPurchases((kitData || []).map((k: Record<string, unknown>) => ({
      ...k,
      item_name: (k.kit_items as Record<string, string>)?.item_name,
    })) as KitPurchase[]);

    setLoading(false);
  }

  if (loading || !player) return <PageLoading />;

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const monthsEnrolled = Math.max(1,
    (new Date().getFullYear() * 12 + new Date().getMonth()) -
    (new Date(player.registration_date).getFullYear() * 12 + new Date(player.registration_date).getMonth()) + 1
  );
  const totalExpected = player.fee_amount * monthsEnrolled;
  const debt = totalExpected - totalPaid;

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalSessions = attendance.length;
  const attendancePct = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  const tabs = [
    { id: 'info' as const, label: '📋 المعلومات' },
    { id: 'attendance' as const, label: '📊 الحضور' },
    { id: 'payments' as const, label: '💰 المدفوعات' },
    { id: 'kits' as const, label: '👕 الأطقم' },
  ];

  return (
    <div>
      {/* Back button */}
      <button onClick={() => navigate('/players')} className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-sm mb-4 bg-transparent border-none cursor-pointer font-[Cairo] hover:underline">
        ← العودة للاعبين
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="p-6" style={{ background: 'linear-gradient(135deg, #14532d, #166534)' }}>
          <div className="flex items-center gap-4 text-white">
            <div className="w-16 h-16 bg-emerald-400/20 border-2 border-emerald-300 rounded-full flex items-center justify-center text-3xl overflow-hidden shrink-0">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold font-arabic text-emerald-100">{player.full_name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold">{player.full_name}</h3>
              <p className="text-emerald-200 text-sm">{player.player_code} — {player.group_name || 'بدون مجموعة'} — {player.branch_name}</p>
            </div>
            <div className="mr-auto">
              <StatusBadge status={player.status} />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 rtl:divide-x-reverse">
          <div className="p-4 text-center">
            <div className="text-2xl font-extrabold text-emerald-600 tabular-nums">{attendancePct}%</div>
            <div className="text-xs text-slate-500 mt-0.5">نسبة الحضور</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-extrabold tabular-nums text-emerald-600">{formatMoney(totalPaid)}</div>
            <div className="text-xs text-slate-500 mt-0.5">إجمالي المدفوع</div>
          </div>
          <div className="p-4 text-center">
            <div className={`text-2xl font-extrabold tabular-nums ${debt > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatMoney(debt)}</div>
            <div className="text-xs text-slate-500 mt-0.5">المديونية</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-extrabold text-blue-500 tabular-nums">{calculateAge(player.date_of_birth) ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-0.5">العمر</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo]
              ${tab === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {tab === 'info' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: 'الاسم الكامل', value: player.full_name },
                { label: 'كود اللاعب', value: player.player_code },
                { label: 'الهاتف', value: player.phone || '—' },
                { label: 'هاتف ولي الأمر', value: player.parent_phone || '—' },
                { label: 'تاريخ الميلاد', value: formatDate(player.date_of_birth) },
                { label: 'المجموعة', value: player.group_name || '—' },
                { label: 'الفرع', value: player.branch_name || '—' },
                { label: 'تاريخ التسجيل', value: formatDate(player.registration_date) },
                { label: 'المبلغ الشهري', value: `${formatMoney(player.fee_amount)} ج.م` },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-slate-400 font-semibold mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-slate-700">{item.value}</div>
                </div>
              ))}
            </div>
            {player.notes && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 font-semibold mb-1">ملاحظات</div>
                <p className="text-sm text-slate-600">{player.notes}</p>
              </div>
            )}
            {/* WhatsApp debt reminder */}
            {debt > 0 && player.parent_phone && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <a
                  href={buildWhatsAppLink(player.parent_phone, debtReminderMessage(player.full_name, debt))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 transition-colors no-underline"
                >
                  📱 إرسال تذكير WhatsApp بالمديونية
                </a>
              </div>
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <span className="text-sm text-slate-500">آخر {attendance.length} حصة</span>
            </div>
            <table className="premium-table">
              <thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a.id}>
                    <td className="text-sm">{formatDate(a.session_date)}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td colSpan={2} className="text-center text-slate-400 py-8">لا توجد سجلات حضور</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payments' && (
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">سجل المدفوعات</span>
              <div className="text-sm">
                المتوقع: <strong className="tabular-data">{formatMoney(totalExpected)}</strong> —
                المدفوع: <strong className="text-emerald-600 tabular-nums">{formatMoney(totalPaid)}</strong> —
                المتبقي: <strong className={`tabular-nums ${debt > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatMoney(debt)}</strong>
              </div>
            </div>
            <table className="premium-table">
              <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الفترة</th><th>ملاحظات</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="text-sm">{formatDate(p.payment_date)}</td>
                    <td className="tabular-data font-semibold text-emerald-600">{formatMoney(p.amount)}</td>
                    <td className="text-sm">{p.method === 'cash' ? 'نقدي' : 'تحويل'}</td>
                    <td className="text-sm text-slate-500">{p.period_covered || '—'}</td>
                    <td className="text-xs text-slate-400">{p.notes || '—'}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">لا توجد مدفوعات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'kits' && (
          <div className="premium-card overflow-hidden">
            <table className="premium-table">
              <thead><tr><th>المنتج</th><th>المقاس</th><th>الكمية</th><th>الإجمالي</th><th>المدفوع</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {kitPurchases.map(k => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.item_name}</td>
                    <td>{k.size || '—'}</td>
                    <td className="tabular-data">{k.quantity}</td>
                    <td className="tabular-data">{formatMoney(k.total_price)}</td>
                    <td className="tabular-data text-emerald-600">{formatMoney(k.amount_paid)}</td>
                    <td><StatusBadge status={k.payment_status} /></td>
                    <td className="text-sm">{formatDate(k.purchase_date)}</td>
                  </tr>
                ))}
                {kitPurchases.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-8">لا توجد مشتريات أطقم</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
