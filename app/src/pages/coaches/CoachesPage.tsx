import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatDate, getCurrentMonth } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import { BranchBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Users } from 'lucide-react';
import type { Coach, CoachAdvance, CoachSalaryPayment } from '../../lib/types';

export default function CoachesPage() {
  const { branchFilter } = useBranch();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [advances, setAdvances] = useState<CoachAdvance[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<CoachSalaryPayment[]>([]);

  // Modals
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(getCurrentMonth());

  // Add Coach Modal
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', phone: '', specialization: '', salary: '0' });

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('coaches')
      .select('*, users(full_name, phone, branch_id, is_active, branches(name))');
    
    const { data } = await q;
    const mapped = (data || []).filter((c: Record<string, unknown>) => {
      const user = c.users as Record<string, unknown>;
      if (!user) return false;
      if (branchFilter && user.branch_id !== branchFilter) return false;
      return true;
    }).map((c: Record<string, unknown>) => {
      const user = c.users as Record<string, unknown>;
      return {
        ...c,
        full_name: user?.full_name,
        phone: user?.phone,
        branch_id: user?.branch_id,
        is_active: user?.is_active,
        branch_name: (user?.branches as Record<string, string>)?.name,
      };
    }) as Coach[];

    setCoaches(mapped);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  async function openCoachDetail(coach: Coach) {
    setSelectedCoach(coach);
    // Load advances
    const { data: adv } = await supabase.from('coach_advances')
      .select('*').eq('coach_id', coach.user_id).order('advance_date', { ascending: false });
    setAdvances(adv || []);
    // Load salary payments
    const { data: sal } = await supabase.from('coach_salary_payments')
      .select('*').eq('coach_id', coach.user_id).order('payment_date', { ascending: false });
    setSalaryPayments(sal || []);
  }

  async function addAdvance() {
    if (!advanceAmount || !selectedCoach) return;
    const { error } = await supabase.from('coach_advances').insert({
      coach_id: selectedCoach.user_id,
      branch_id: selectedCoach.branch_id,
      amount: Number(advanceAmount),
      notes: advanceNotes || null,
    });
    if (error) { toast('error', 'خطأ في تسجيل السلفة'); return; }
    toast('success', 'تم تسجيل السلفة');
    setShowAdvanceForm(false);
    setAdvanceAmount(''); setAdvanceNotes('');
    openCoachDetail(selectedCoach);
  }

  async function addSalaryPayment() {
    if (!salaryAmount || !selectedCoach) return;
    const { error } = await supabase.from('coach_salary_payments').insert({
      coach_id: selectedCoach.user_id,
      branch_id: selectedCoach.branch_id,
      amount: Number(salaryAmount),
      payment_month: salaryMonth,
    });
    if (error) { toast('error', 'خطأ في تسجيل الراتب'); return; }
    toast('success', 'تم تسجيل دفعة الراتب');
    setShowSalaryForm(false);
    setSalaryAmount('');
    openCoachDetail(selectedCoach);
  }

  async function handleAddCoach() {
    if (!newCoach.name || !newCoach.phone) {
      toast('error', 'يرجى إدخال اسم ورقم المدرب');
      return;
    }
    
    // Generate a dummy email and password since coaches don't log in
    const dummyEmail = `coach_${Date.now()}@vfc.com`;
    const dummyPassword = `coach_${Math.random().toString(36).slice(-8)}`;

    const { data, error } = await supabase.rpc('rpc_create_user', {
      p_email: dummyEmail,
      p_password: dummyPassword,
      p_full_name: newCoach.name,
      p_phone: newCoach.phone,
      p_role: 'coach',
      p_branch_id: branchFilter || null
    });

    if (error) {
      toast('error', 'حدث خطأ أثناء إضافة المدرب');
      console.error(error);
      return;
    }

    // Update specialization and salary
    if (data) {
      await supabase.from('coaches').update({
        specialization: newCoach.specialization,
        base_salary: Number(newCoach.salary) || 0
      }).eq('user_id', data);
    }

    toast('success', 'تم إضافة المدرب بنجاح');
    setShowAddCoach(false);
    setNewCoach({ name: '', phone: '', specialization: '', salary: '0' });
    loadCoaches();
  }

  if (loading) return <PageLoading />;

  // Coach detail view
  if (selectedCoach) {
    const monthAdvances = advances
      .filter(a => a.advance_date?.startsWith(getCurrentMonth()))
      .reduce((s, a) => s + Number(a.amount), 0);
    const netDue = Number(selectedCoach.base_salary) - monthAdvances;

    return (
      <div>
        <button onClick={() => setSelectedCoach(null)} className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-sm mb-4 bg-transparent border-none cursor-pointer font-[Cairo] hover:underline">
          ← العودة للمدربين
        </button>

        {/* Profile header */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
          <div className="p-6" style={{ background: 'linear-gradient(135deg, #14532d, #166534)' }}>
            <div className="flex items-center gap-4 text-white">
              <div className="w-14 h-14 bg-emerald-400/20 border-2 border-emerald-300 rounded-full flex items-center justify-center text-xl font-bold font-arabic overflow-hidden shrink-0">
                {(selectedCoach.full_name || '👤').charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold">{selectedCoach.full_name}</h3>
                <p className="text-emerald-200 text-sm">{selectedCoach.specialization} — {selectedCoach.branch_name}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 rtl:divide-x-reverse">
            <div className="p-4 text-center">
              <div className="text-xl font-extrabold text-slate-700 tabular-nums">{formatMoney(selectedCoach.base_salary)}</div>
              <div className="text-xs text-slate-500">الراتب الأساسي</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xl font-extrabold text-red-500 tabular-nums">{formatMoney(monthAdvances)}</div>
              <div className="text-xs text-slate-500">سلف هذا الشهر</div>
            </div>
            <div className="p-4 text-center">
              <div className={`text-xl font-extrabold tabular-nums ${netDue >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatMoney(netDue)}</div>
              <div className="text-xs text-slate-500">صافي المستحق</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-5">
          <button onClick={() => setShowAdvanceForm(true)} className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors cursor-pointer">+ تسجيل سلفة</button>
          <button onClick={() => { setSalaryAmount(String(netDue > 0 ? netDue : selectedCoach.base_salary)); setShowSalaryForm(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors cursor-pointer">💰 صرف الراتب</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Advances */}
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800">السلف</h4></div>
            <table className="premium-table">
              <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id}>
                    <td className="text-sm">{formatDate(a.advance_date)}</td>
                    <td className="tabular-data font-semibold text-amber-600">{formatMoney(a.amount)}</td>
                    <td className="text-xs text-slate-400">{a.notes || '—'}</td>
                  </tr>
                ))}
                {advances.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">لا توجد سلف</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Salary Payments */}
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800">دفعات الراتب</h4></div>
            <table className="premium-table">
              <thead><tr><th>الشهر</th><th>المبلغ</th><th>تاريخ الصرف</th></tr></thead>
              <tbody>
                {salaryPayments.map(s => (
                  <tr key={s.id}>
                    <td className="text-sm">{s.payment_month}</td>
                    <td className="tabular-data font-semibold text-emerald-600">{formatMoney(s.amount)}</td>
                    <td className="text-sm">{formatDate(s.payment_date)}</td>
                  </tr>
                ))}
                {salaryPayments.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">لا توجد دفعات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Advance Modal */}
        <Modal isOpen={showAdvanceForm} onClose={() => setShowAdvanceForm(false)} title="تسجيل سلفة" footer={
          <><button onClick={addAdvance} className="px-5 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm cursor-pointer">تسجيل</button>
            <button onClick={() => setShowAdvanceForm(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4">
            <div><label className="block text-sm font-semibold mb-1">المبلغ</label>
              <input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
            <div><label className="block text-sm font-semibold mb-1">ملاحظات</label>
              <input value={advanceNotes} onChange={(e) => setAdvanceNotes(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          </div>
        </Modal>

        {/* Salary Modal */}
        <Modal isOpen={showSalaryForm} onClose={() => setShowSalaryForm(false)} title="صرف الراتب" footer={
          <><button onClick={addSalaryPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">صرف</button>
            <button onClick={() => setShowSalaryForm(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4">
            <div><label className="block text-sm font-semibold mb-1">المبلغ</label>
              <input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
            <div><label className="block text-sm font-semibold mb-1">الشهر</label>
              <input type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          </div>
        </Modal>
      </div>
    );
  }

  // Coach list
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">المدربين</h2>
        <button 
          onClick={() => setShowAddCoach(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors"
        >
          + إضافة مدرب
        </button>
      </div>

      <Modal isOpen={showAddCoach} onClose={() => setShowAddCoach(false)} title="إضافة مدرب جديد" footer={
        <>
          <button onClick={handleAddCoach} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">إضافة الكابتن</button>
          <button onClick={() => setShowAddCoach(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold mb-1">الاسم بالكامل *</label>
            <input value={newCoach.name} onChange={(e) => setNewCoach(f => ({...f, name: e.target.value}))} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-semibold mb-1">رقم الهاتف *</label>
            <input value={newCoach.phone} onChange={(e) => setNewCoach(f => ({...f, phone: e.target.value}))} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
          <div><label className="block text-sm font-semibold mb-1">التخصص</label>
            <input value={newCoach.specialization} onChange={(e) => setNewCoach(f => ({...f, specialization: e.target.value}))} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" placeholder="مثال: مدرب حراس مرمى" /></div>
          <div><label className="block text-sm font-semibold mb-1">الراتب الأساسي</label>
            <input type="number" value={newCoach.salary} onChange={(e) => setNewCoach(f => ({...f, salary: e.target.value}))} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
        </div>
      </Modal>

      {coaches.length === 0 ? (
        <EmptyState icon={<Users size={48} className="text-slate-300 mb-4" />} title="لا يوجد مدربين" subtitle="قم بإضافة مستخدم وترقيته لمدرب" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map(c => (
            <div key={c.user_id} onClick={() => openCoachDetail(c)}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex justify-center items-center font-bold font-arabic text-lg shrink-0">
                    {(c.full_name || '👤').charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{c.full_name}</h4>
                    <p className="text-xs text-slate-500">{c.specialization || 'مدرب'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">الراتب: <strong className="text-slate-700 tabular-nums">{formatMoney(c.base_salary)}</strong></span>
                {c.branch_name && <BranchBadge branchId={c.branch_id || ''} branchName={c.branch_name} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
