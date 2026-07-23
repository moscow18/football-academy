import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatDate, getCurrentMonth } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import { BranchBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Users, Edit2, Trash2 } from 'lucide-react';
import type { Coach, CoachAdvance, CoachSalaryPayment } from '../../lib/types';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';

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

  // Advance Edit & Delete State
  const [editingAdvance, setEditingAdvance] = useState<CoachAdvance | null>(null);
  const [advanceToDelete, setAdvanceToDelete] = useState<CoachAdvance | null>(null);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState('');
  const [editAdvanceNotes, setEditAdvanceNotes] = useState('');
  const [isDeletingAdvance, setIsDeletingAdvance] = useState(false);

  // Salary Payment Edit & Delete State
  const [editingSalaryPayment, setEditingSalaryPayment] = useState<CoachSalaryPayment | null>(null);
  const [salaryPaymentToDelete, setSalaryPaymentToDelete] = useState<CoachSalaryPayment | null>(null);
  const [editSalaryPaymentAmount, setEditSalaryPaymentAmount] = useState('');
  const [editSalaryPaymentMonth, setEditSalaryPaymentMonth] = useState('');
  const [isDeletingSalaryPayment, setIsDeletingSalaryPayment] = useState(false);

  // Delete Coach State
  const [coachToDelete, setCoachToDelete] = useState<Coach | null>(null);
  const [isDeletingCoach, setIsDeletingCoach] = useState(false);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    
    // Fetch users with role='coach', coaches records, and salary payments in parallel
    const [usersRes, coachesRes, salaryPaymentsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, phone, branch_id, is_active, created_at, branches(name)')
        .eq('role', 'coach'),
      supabase
        .from('coaches')
        .select('*'),
      supabase
        .from('coach_salary_payments')
        .select('coach_id, amount, payment_date')
        .order('payment_date', { ascending: false })
    ]);

    const usersData = usersRes.data || [];
    const coachesData = coachesRes.data || [];
    const salaryPaymentsData = salaryPaymentsRes.data || [];

    const coachMap = new Map<string, any>();
    coachesData.forEach((c: any) => {
      coachMap.set(c.user_id, c);
    });

    const latestPaymentMap = new Map<string, number>();
    salaryPaymentsData.forEach((sp: any) => {
      if (!latestPaymentMap.has(sp.coach_id)) {
        latestPaymentMap.set(sp.coach_id, Number(sp.amount || 0));
      }
    });

    const mapped = usersData
      .filter((u: any) => !branchFilter || u.branch_id === branchFilter)
      .map((u: any) => {
        const c = coachMap.get(u.id);
        const recordedBaseSalary = Number(c?.base_salary || 0);
        const latestPayment = latestPaymentMap.get(u.id) || 0;
        const effectiveBaseSalary = recordedBaseSalary > 0 ? recordedBaseSalary : latestPayment;

        return {
          user_id: u.id,
          full_name: u.full_name,
          phone: u.phone,
          branch_id: u.branch_id,
          is_active: u.is_active,
          branch_name: u.branches?.name,
          base_salary: effectiveBaseSalary,
          specialization: c?.specialization || 'مدرب',
          hire_date: c?.hire_date || u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        };
      }) as Coach[];

    setCoaches(mapped);
    setLoading(false);
  }, [branchFilter]);

  const loadCoachDetails = useCallback(async (coachId: string) => {
    // Load advances
    const { data: adv } = await supabase.from('coach_advances')
      .select('*').eq('coach_id', coachId).order('advance_date', { ascending: false });
    setAdvances(adv || []);
    // Load salary payments
    const { data: sal } = await supabase.from('coach_salary_payments')
      .select('*').eq('coach_id', coachId).order('payment_date', { ascending: false });
    setSalaryPayments(sal || []);
  }, []);

  const refreshAll = useCallback(() => {
    loadCoaches();
    if (selectedCoach) {
      loadCoachDetails(selectedCoach.user_id);
    }
  }, [loadCoaches, selectedCoach, loadCoachDetails]);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  // ⚡ Realtime: auto-refresh coaches, advances, and salary payments
  useRealtimeRefresh(['coaches', 'coach_advances', 'coach_salary_payments'], refreshAll);

  async function openCoachDetail(coach: Coach) {
    setSelectedCoach(coach);
    loadCoachDetails(coach.user_id);
  }

  async function addAdvance() {
    if (!advanceAmount || !selectedCoach) return;
    const targetBranchId = selectedCoach.branch_id || branchFilter || null;
    const { error } = await supabase.from('coach_advances').insert({
      coach_id: selectedCoach.user_id,
      branch_id: targetBranchId,
      amount: Number(advanceAmount),
      notes: advanceNotes || null,
    });
    if (error) { toast('error', 'خطأ في تسجيل السلفة: ' + error.message); return; }
    toast('success', 'تم تسجيل السلفة');
    setShowAdvanceForm(false);
    setAdvanceAmount(''); setAdvanceNotes('');
    openCoachDetail(selectedCoach);
  }

  async function addSalaryPayment() {
    if (!salaryAmount || !selectedCoach) return;
    const targetBranchId = selectedCoach.branch_id || branchFilter || null;
    const { error } = await supabase.from('coach_salary_payments').insert({
      coach_id: selectedCoach.user_id,
      branch_id: targetBranchId,
      amount: Number(salaryAmount),
      payment_month: salaryMonth,
    });
    if (error) { toast('error', 'خطأ في تسجيل الراتب: ' + error.message); return; }
    toast('success', 'تم تسجيل دفعة الراتب');
    setShowSalaryForm(false);
    setSalaryAmount('');
    openCoachDetail(selectedCoach);
  }

  async function handleUpdateAdvance() {
    if (!editingAdvance || !editAdvanceAmount) return;
    const { error } = await supabase.from('coach_advances').update({
      amount: Number(editAdvanceAmount),
      notes: editAdvanceNotes || null,
    }).eq('id', editingAdvance.id);
    if (error) { toast('error', 'خطأ في تعديل السلفة: ' + error.message); return; }
    toast('success', 'تم تعديل السلفة بنجاح');
    setEditingAdvance(null);
    if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
  }

  async function confirmDeleteAdvance() {
    if (!advanceToDelete) return;
    setIsDeletingAdvance(true);
    try {
      const { error } = await supabase.from('coach_advances').delete().eq('id', advanceToDelete.id);
      if (error) { toast('error', 'خطأ في مسح السلفة: ' + error.message); return; }
      toast('success', 'تم مسح السلفة بنجاح');
      setAdvanceToDelete(null);
      if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
    } finally {
      setIsDeletingAdvance(false);
    }
  }

  async function handleUpdateSalaryPayment() {
    if (!editingSalaryPayment || !editSalaryPaymentAmount) return;
    const { error } = await supabase.from('coach_salary_payments').update({
      amount: Number(editSalaryPaymentAmount),
      payment_month: editSalaryPaymentMonth || editingSalaryPayment.payment_month,
    }).eq('id', editingSalaryPayment.id);
    if (error) { toast('error', 'خطأ في تعديل دفعة الراتب: ' + error.message); return; }
    toast('success', 'تم تعديل دفعة الراتب بنجاح');
    setEditingSalaryPayment(null);
    if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
  }

  async function confirmDeleteSalaryPayment() {
    if (!salaryPaymentToDelete) return;
    setIsDeletingSalaryPayment(true);
    try {
      const { error } = await supabase.from('coach_salary_payments').delete().eq('id', salaryPaymentToDelete.id);
      if (error) { toast('error', 'خطأ في مسح دفعة الراتب: ' + error.message); return; }
      toast('success', 'تم مسح دفعة الراتب بنجاح');
      setSalaryPaymentToDelete(null);
      if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
    } finally {
      setIsDeletingSalaryPayment(false);
    }
  }

  async function confirmDeleteCoach() {
    if (!coachToDelete) return;
    setIsDeletingCoach(true);
    try {
      await supabase.from('coach_advances').delete().eq('coach_id', coachToDelete.user_id);
      await supabase.from('coach_salary_payments').delete().eq('coach_id', coachToDelete.user_id);
      await supabase.from('coaches').delete().eq('user_id', coachToDelete.user_id);
      const { error } = await supabase.from('users').delete().eq('id', coachToDelete.user_id);
      if (error) { toast('error', 'خطأ في حذف الكابتن: ' + error.message); return; }
      toast('success', `تم حذف الكابتن "${coachToDelete.full_name}" بجميع بياناته بنجاح`);
      setCoachToDelete(null);
      setSelectedCoach(null);
      loadCoaches();
    } finally {
      setIsDeletingCoach(false);
    }
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
      toast('error', 'حدث خطأ أثناء إضافة المدرب: ' + error.message);
      console.error(error);
      return;
    }

    // Upsert specialization and salary
    if (data) {
      await supabase.from('coaches').upsert({
        user_id: data,
        specialization: newCoach.specialization || null,
        base_salary: Number(newCoach.salary) || 0
      });
    }

    toast('success', 'تم إضافة المدرب بنجاح');
    setShowAddCoach(false);
    setNewCoach({ name: '', phone: '', specialization: '', salary: '0' });
    loadCoaches();
  }

  // Edit Salary State
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [editSalaryValue, setEditSalaryValue] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');

  const handleUpdateCoachSalary = async () => {
    if (!selectedCoach) return;
    const newSalary = Number(editSalaryValue) || 0;
    
    const { error } = await supabase.from('coaches').upsert({
      user_id: selectedCoach.user_id,
      base_salary: newSalary,
      specialization: editSpecialization || selectedCoach.specialization || null
    });

    if (error) {
      toast('error', 'حدث خطأ أثناء تحديث الراتب: ' + error.message);
      return;
    }

    toast('success', 'تم تحديث الراتب الأساسي بنجاح');
    setSelectedCoach(prev => prev ? { ...prev, base_salary: newSalary, specialization: editSpecialization || prev.specialization } : null);
    setShowEditSalary(false);
    loadCoaches();
  };

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
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-400/20 border-2 border-emerald-300 rounded-full flex items-center justify-center text-xl font-bold font-arabic overflow-hidden shrink-0">
                  {(selectedCoach.full_name || '👤').charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedCoach.full_name}</h3>
                  <p className="text-emerald-200 text-sm">{selectedCoach.specialization || 'مدرب'} — {selectedCoach.branch_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditSalaryValue(String(selectedCoach.base_salary));
                    setEditSpecialization(selectedCoach.specialization || '');
                    setShowEditSalary(true);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all border border-white/20 flex items-center gap-1 cursor-pointer"
                >
                  ✏️ تعديل الراتب
                </button>
                <button
                  onClick={() => setCoachToDelete(selectedCoach)}
                  className="px-3 py-1.5 bg-red-500/30 hover:bg-red-500/50 text-white rounded-lg text-xs font-bold transition-all border border-red-300/30 flex items-center gap-1 cursor-pointer"
                  title="حذف المدرب نهائياً من النظام"
                >
                  <Trash2 size={14} /> حذف الكابتن
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 rtl:divide-x-reverse">
            <div 
              className="p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => {
                setEditSalaryValue(String(selectedCoach.base_salary));
                setEditSpecialization(selectedCoach.specialization || '');
                setShowEditSalary(true);
              }}
              title="انقر لتعديل الراتب الأساسي"
            >
              <div className="text-xl font-extrabold text-slate-700 tabular-nums flex items-center justify-center gap-1">
                {formatMoney(selectedCoach.base_salary)}
                <span className="text-xs text-emerald-600 font-normal">✏️</span>
              </div>
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
          <button 
            onClick={() => {
              setEditSalaryValue(String(selectedCoach.base_salary));
              setEditSpecialization(selectedCoach.specialization || '');
              setShowEditSalary(true);
            }} 
            className="px-4 py-2 bg-slate-700 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✏️ تعديل الراتب الأساسي
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Advances */}
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800">السلف المسجلة</h4></div>
            <table className="premium-table">
              <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th><th className="text-left">إجراءات</th></tr></thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id}>
                    <td className="text-sm">{formatDate(a.advance_date)}</td>
                    <td className="tabular-data font-semibold text-amber-600">{formatMoney(a.amount)}</td>
                    <td className="text-xs text-slate-400 max-w-[120px] truncate">{a.notes || '—'}</td>
                    <td className="text-left">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingAdvance(a); setEditAdvanceAmount(String(a.amount)); setEditAdvanceNotes(a.notes || ''); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="تعديل السلفة">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setAdvanceToDelete(a)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="مسح السلفة">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {advances.length === 0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6">لا توجد سلف</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Salary Payments */}
          <div className="premium-card overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800">دفعات الراتب المسددة</h4></div>
            <table className="premium-table">
              <thead><tr><th>الشهر</th><th>المبلغ</th><th>تاريخ الصرف</th><th className="text-left">إجراءات</th></tr></thead>
              <tbody>
                {salaryPayments.map(s => (
                  <tr key={s.id}>
                    <td className="text-sm font-bold">{s.payment_month}</td>
                    <td className="tabular-data font-semibold text-emerald-600">{formatMoney(s.amount)}</td>
                    <td className="text-sm">{formatDate(s.payment_date)}</td>
                    <td className="text-left">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingSalaryPayment(s); setEditSalaryPaymentAmount(String(s.amount)); setEditSalaryPaymentMonth(s.payment_month); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="تعديل دفعة الراتب">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setSalaryPaymentToDelete(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="مسح دفعة الراتب">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {salaryPayments.length === 0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6">لا توجد دفعات</td></tr>}
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

        {/* Edit Base Salary Modal */}
        <Modal isOpen={showEditSalary} onClose={() => setShowEditSalary(false)} title="تعديل الراتب الأساسي والتخصص" footer={
          <><button onClick={handleUpdateCoachSalary} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">حفظ التغييرات</button>
            <button onClick={() => setShowEditSalary(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الراتب الأساسي (ج.م) *</label>
              <input 
                type="number" 
                value={editSalaryValue} 
                onChange={(e) => setEditSalaryValue(e.target.value)} 
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" 
                placeholder="مثال: 3200"
                dir="ltr" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">التخصص / المسمى الوظيفي</label>
              <input 
                value={editSpecialization} 
                onChange={(e) => setEditSpecialization(e.target.value)} 
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" 
                placeholder="مثال: مدرب حراس مرمى" 
              />
            </div>
          </div>
        </Modal>

        {/* Salary Payment Modal */}
        <Modal isOpen={showSalaryForm} onClose={() => setShowSalaryForm(false)} title="صرف الراتب" footer={
          <><button onClick={addSalaryPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">صرف</button>
            <button onClick={() => setShowSalaryForm(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div><label className="block text-sm font-semibold mb-1">المبلغ</label>
              <input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
            <div><label className="block text-sm font-semibold mb-1">الشهر</label>
              <input type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          </div>
        </Modal>

        {/* Edit Advance Modal */}
        <Modal isOpen={!!editingAdvance} onClose={() => setEditingAdvance(null)} title="تعديل بيانات السلفة" footer={
          <><button onClick={handleUpdateAdvance} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">حفظ التغييرات</button>
            <button onClick={() => setEditingAdvance(null)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div><label className="block text-sm font-semibold mb-1 text-slate-700">مبلغ السلفة *</label>
              <input type="number" value={editAdvanceAmount} onChange={(e) => setEditAdvanceAmount(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
            <div><label className="block text-sm font-semibold mb-1 text-slate-700">ملاحظات</label>
              <input value={editAdvanceNotes} onChange={(e) => setEditAdvanceNotes(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          </div>
        </Modal>

        {/* Edit Salary Payment Modal */}
        <Modal isOpen={!!editingSalaryPayment} onClose={() => setEditingSalaryPayment(null)} title="تعديل دفعة الراتب" footer={
          <><button onClick={handleUpdateSalaryPayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">حفظ التغييرات</button>
            <button onClick={() => setEditingSalaryPayment(null)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div><label className="block text-sm font-semibold mb-1 text-slate-700">المبلغ *</label>
              <input type="number" value={editSalaryPaymentAmount} onChange={(e) => setEditSalaryPaymentAmount(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
            <div><label className="block text-sm font-semibold mb-1 text-slate-700">الشهر *</label>
              <input type="month" value={editSalaryPaymentMonth} onChange={(e) => setEditSalaryPaymentMonth(e.target.value)} className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" /></div>
          </div>
        </Modal>

        {/* Confirm Delete Advance Modal */}
        <ConfirmModal
          isOpen={!!advanceToDelete}
          onClose={() => setAdvanceToDelete(null)}
          onConfirm={confirmDeleteAdvance}
          title="تأكيد مسح السلفة"
          message={`هل أنت متأكد من مسح هذه السلفة بقيمة (${formatMoney(advanceToDelete?.amount || 0)} ج.م)؟\nسيتم تعديل صافي المستحق للكابتن تلقائياً.`}
          confirmText="نعم، احذف السلفة"
          cancelText="إلغاء"
          variant="danger"
          isLoading={isDeletingAdvance}
        />

        {/* Confirm Delete Salary Payment Modal */}
        <ConfirmModal
          isOpen={!!salaryPaymentToDelete}
          onClose={() => setSalaryPaymentToDelete(null)}
          onConfirm={confirmDeleteSalaryPayment}
          title="تأكيد مسح دفعة الراتب"
          message={`هل أنت متأكد من مسح دفعة الراتب بقيمة (${formatMoney(salaryPaymentToDelete?.amount || 0)} ج.م) لشهر ${salaryPaymentToDelete?.payment_month}؟`}
          confirmText="نعم، احذف الدفعة"
          cancelText="إلغاء"
          variant="danger"
          isLoading={isDeletingSalaryPayment}
        />

        {/* Confirm Delete Coach Modal */}
        <ConfirmModal
          isOpen={!!coachToDelete}
          onClose={() => setCoachToDelete(null)}
          onConfirm={confirmDeleteCoach}
          title="تأكيد حذف المدرب نهائياً"
          message={`هل أنت متأكد من حذف الكابتن "${coachToDelete?.full_name}" تماماً من النظام؟\nسيؤدي هذا إلى حذف بياناته وسجل سلفه ودفعات رواتبه نهائياً ولا يمكن التراجع عن ذلك.`}
          confirmText="نعم، احذف المدرب"
          cancelText="إلغاء الإجراء"
          variant="danger"
          isLoading={isDeletingCoach}
        />
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
