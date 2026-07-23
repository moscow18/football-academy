import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatDate, getCurrentMonth } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import { BranchBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { 
  Users, 
  UserPlus, 
  Search, 
  Wallet, 
  Phone, 
  Award, 
  Edit2, 
  Trash2, 
  Plus, 
  ArrowRight, 
  CheckCircle2,
  DollarSign
} from 'lucide-react';
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

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

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

  // Edit Base Salary State
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [editSalaryValue, setEditSalaryValue] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');

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
          specialization: c?.specialization || 'مدرب فني',
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

  // Realtime Refresh
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
    toast('success', 'تم تسجيل السلفة بنجاح ✅');
    setShowAdvanceForm(false);
    setAdvanceAmount('');
    setAdvanceNotes('');
    loadCoachDetails(selectedCoach.user_id);
  }

  async function handleUpdateAdvance() {
    if (!editingAdvance || !editAdvanceAmount) return;
    const { error } = await supabase
      .from('coach_advances')
      .update({
        amount: Number(editAdvanceAmount),
        notes: editAdvanceNotes || null,
      })
      .eq('id', editingAdvance.id);

    if (error) {
      toast('error', 'خطأ في تعديل السلفة: ' + error.message);
      return;
    }

    toast('success', 'تم تعديل بيانات السلفة بنجاح ✅');
    setEditingAdvance(null);
    if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
  }

  async function confirmDeleteAdvance() {
    if (!advanceToDelete) return;
    setIsDeletingAdvance(true);
    try {
      const { error } = await supabase
        .from('coach_advances')
        .delete()
        .eq('id', advanceToDelete.id);

      if (error) {
        toast('error', 'فشل مسح السلفة: ' + error.message);
        return;
      }

      toast('success', 'تم مسح السلفة بنجاح ✅');
      setAdvanceToDelete(null);
      if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
    } finally {
      setIsDeletingAdvance(false);
    }
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
    if (error) { toast('error', 'خطأ في صرف الراتب: ' + error.message); return; }
    toast('success', `تم صرف الراتب لشهر (${salaryMonth}) بنجاح ✅`);
    setShowSalaryForm(false);
    setSalaryAmount('');
    loadCoachDetails(selectedCoach.user_id);
  }

  async function handleUpdateSalaryPayment() {
    if (!editingSalaryPayment || !editSalaryPaymentAmount) return;
    const { error } = await supabase
      .from('coach_salary_payments')
      .update({
        amount: Number(editSalaryPaymentAmount),
        payment_month: editSalaryPaymentMonth,
      })
      .eq('id', editingSalaryPayment.id);

    if (error) {
      toast('error', 'خطأ في تعديل دفعة الراتب: ' + error.message);
      return;
    }

    toast('success', 'تم تعديل دفعة الراتب بنجاح ✅');
    setEditingSalaryPayment(null);
    if (selectedCoach) loadCoachDetails(selectedCoach.user_id);
  }

  async function confirmDeleteSalaryPayment() {
    if (!salaryPaymentToDelete) return;
    setIsDeletingSalaryPayment(true);
    try {
      const { error } = await supabase
        .from('coach_salary_payments')
        .delete()
        .eq('id', salaryPaymentToDelete.id);

      if (error) {
        toast('error', 'فشل مسح دفعة الراتب: ' + error.message);
        return;
      }

      toast('success', 'تم مسح دفعة الراتب بنجاح ✅');
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
      const { error: advErr } = await supabase.from('coach_advances').delete().eq('coach_id', coachToDelete.user_id);
      if (advErr) console.warn('Error deleting coach advances:', advErr);

      const { error: salErr } = await supabase.from('coach_salary_payments').delete().eq('coach_id', coachToDelete.user_id);
      if (salErr) console.warn('Error deleting coach salary payments:', salErr);

      const { error: coachRecordErr } = await supabase.from('coaches').delete().eq('user_id', coachToDelete.user_id);
      if (coachRecordErr) console.warn('Error deleting coach record:', coachRecordErr);

      const { error: userErr } = await supabase.from('users').delete().eq('id', coachToDelete.user_id);
      if (userErr) {
        toast('error', `فشل حذف المدرب: ${userErr.message}`);
        return;
      }

      toast('success', `تم حذف الكابتن "${coachToDelete.full_name}" نهائياً من النظام ✅`);
      setCoachToDelete(null);
      setSelectedCoach(null);
      loadCoaches();
    } finally {
      setIsDeletingCoach(false);
    }
  }

  async function handleAddCoach() {
    if (!newCoach.name || !newCoach.phone) {
      toast('error', 'يرجى إدخال اسم ورقم هاتف المدرب');
      return;
    }
    const cleanPhone = newCoach.phone.replace(/[^0-9]/g, '');
    const dummyEmail = `coach_${cleanPhone || Math.floor(Math.random()*100000)}@academy.com`;
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

    if (data) {
      await supabase.from('coaches').upsert({
        user_id: data,
        specialization: newCoach.specialization || null,
        base_salary: Number(newCoach.salary) || 0
      });
    }

    toast('success', 'تم إضافة المدرب بنجاح ✅');
    setShowAddCoach(false);
    setNewCoach({ name: '', phone: '', specialization: '', salary: '0' });
    loadCoaches();
  }

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

    toast('success', 'تم تحديث الراتب الأساسي بنجاح ✅');
    setSelectedCoach(prev => prev ? { ...prev, base_salary: newSalary, specialization: editSpecialization || prev.specialization } : null);
    setShowEditSalary(false);
    loadCoaches();
  };

  if (loading) return <PageLoading />;

  // Filtered coaches
  const filteredCoaches = coaches.filter(c => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      c.full_name?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.specialization?.toLowerCase().includes(query) ||
      c.branch_name?.toLowerCase().includes(query)
    );
  });

  const totalSalariesBudget = coaches.reduce((sum, c) => sum + Number(c.base_salary || 0), 0);

  // -------------------------------------------------------------
  // Coach Detail View
  // -------------------------------------------------------------
  if (selectedCoach) {
    const monthAdvances = advances
      .filter(a => a.advance_date?.startsWith(getCurrentMonth()))
      .reduce((s, a) => s + Number(a.amount), 0);
    const netDue = Number(selectedCoach.base_salary) - monthAdvances;

    return (
      <div className="space-y-6 animate-fade-in pb-12 font-[Cairo]">
        
        {/* Back Button */}
        <button 
          onClick={() => setSelectedCoach(null)} 
          className="inline-flex items-center gap-2 text-slate-600 hover:text-emerald-700 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
        >
          <ArrowRight size={18} />
          <span>العودة لقائمة المدربين</span>
        </button>

        {/* Profile Hero Card */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white relative overflow-hidden">
            
            {/* Background Glow Overlay */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              
              {/* Left Profile Info */}
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/50 rounded-2xl flex items-center justify-center text-3xl font-black text-emerald-300 shadow-xl shrink-0">
                  {(selectedCoach.full_name || '👤').charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-black text-white tracking-wide">{selectedCoach.full_name}</h3>
                    {selectedCoach.branch_name && (
                      <span className="px-3 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-bold">
                        {selectedCoach.branch_name}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm font-medium flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><Award size={16} className="text-emerald-400" /> {selectedCoach.specialization || 'مدرب فني'}</span>
                    {selectedCoach.phone && (
                      <span className="flex items-center gap-1.5 dir-ltr"><Phone size={14} className="text-emerald-400" /> {selectedCoach.phone}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Top Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setEditSalaryValue(String(selectedCoach.base_salary));
                    setEditSpecialization(selectedCoach.specialization || '');
                    setShowEditSalary(true);
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                >
                  <Edit2 size={15} className="text-emerald-400" />
                  <span>تعديل البيانات والراتب</span>
                </button>
                <button
                  onClick={() => setCoachToDelete(selectedCoach)}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-400/30 flex items-center gap-1.5 cursor-pointer"
                  title="حذف المدرب نهائياً من النظام"
                >
                  <Trash2 size={15} />
                  <span>حذف الكابتن</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 rtl:divide-x-reverse bg-slate-50/50">
            
            {/* Base Salary */}
            <div 
              className="p-6 text-center hover:bg-emerald-50/50 transition-colors cursor-pointer group"
              onClick={() => {
                setEditSalaryValue(String(selectedCoach.base_salary));
                setEditSpecialization(selectedCoach.specialization || '');
                setShowEditSalary(true);
              }}
              title="انقر لتعديل الراتب الأساسي"
            >
              <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-center gap-1">
                <span>الراتب الأساسي الشهري</span>
                <Edit2 size={12} className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-black text-slate-800 font-tabular">
                {formatMoney(selectedCoach.base_salary)} <span className="text-sm font-bold text-slate-500">ج.م</span>
              </div>
            </div>

            {/* Current Month Advances */}
            <div className="p-6 text-center hover:bg-amber-50/50 transition-colors">
              <div className="text-xs font-bold text-amber-700 mb-1">إجمالي السلف هذا الشهر</div>
              <div className="text-3xl font-black text-amber-600 font-tabular">
                {formatMoney(monthAdvances)} <span className="text-sm font-bold text-amber-600">ج.م</span>
              </div>
            </div>

            {/* Net Due */}
            <div className="p-6 text-center bg-emerald-500/5">
              <div className="text-xs font-bold text-emerald-800 mb-1">صافي الراتب المستحق للصرف</div>
              <div className={`text-3xl font-black font-tabular ${netDue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatMoney(netDue)} <span className="text-sm font-bold">ج.م</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowAdvanceForm(true)} 
            className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} />
            <span>تسجيل سلفة جديدة</span>
          </button>
          <button 
            onClick={() => { setSalaryAmount(String(netDue > 0 ? netDue : selectedCoach.base_salary)); setShowSalaryForm(true); }} 
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Wallet size={18} />
            <span>صرف الراتب للشهر الحالي</span>
          </button>
          <button 
            onClick={() => {
              setEditSalaryValue(String(selectedCoach.base_salary));
              setEditSpecialization(selectedCoach.specialization || '');
              setShowEditSalary(true);
            }} 
            className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Edit2 size={16} />
            <span>تعديل بيانات الراتب والتخصص</span>
          </button>
        </div>

        {/* Two Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Advances Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Wallet size={18} className="text-amber-500" />
                <span>سجل السلف المسجلة ({advances.length})</span>
              </h4>
              <button 
                onClick={() => setShowAdvanceForm(true)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 cursor-pointer"
              >
                + سلفة جديدة
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold bg-slate-50">
                    <th className="py-3 px-4 rounded-r-xl">تاريخ السلفة</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">الملاحظات</th>
                    <th className="py-3 px-4 text-left rounded-l-xl">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {advances.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-700">{formatDate(a.advance_date)}</td>
                      <td className="py-3 px-4 font-black text-amber-600 font-tabular text-sm">{formatMoney(a.amount)} ج.م</td>
                      <td className="py-3 px-4 text-slate-500 max-w-[140px] truncate">{a.notes || '—'}</td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => { setEditingAdvance(a); setEditAdvanceAmount(String(a.amount)); setEditAdvanceNotes(a.notes || ''); }} 
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" 
                            title="تعديل السلفة"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => setAdvanceToDelete(a)} 
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" 
                            title="مسح السلفة"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400 py-8 text-xs font-bold">لا توجد سلف مسجلة لهذا المدرب</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Salary Payments Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>سجل رواتب الشهور المسددة ({salaryPayments.length})</span>
              </h4>
              <button 
                onClick={() => { setSalaryAmount(String(netDue > 0 ? netDue : selectedCoach.base_salary)); setShowSalaryForm(true); }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 cursor-pointer"
              >
                + صرف راتب
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold bg-slate-50">
                    <th className="py-3 px-4 rounded-r-xl">عن شهر</th>
                    <th className="py-3 px-4">المبلغ المستلم</th>
                    <th className="py-3 px-4">تاريخ الصرف</th>
                    <th className="py-3 px-4 text-left rounded-l-xl">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {salaryPayments.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-800 font-tabular">{s.payment_month}</td>
                      <td className="py-3 px-4 font-black text-emerald-700 font-tabular text-sm">{formatMoney(s.amount)} ج.م</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(s.payment_date)}</td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => { setEditingSalaryPayment(s); setEditSalaryPaymentAmount(String(s.amount)); setEditSalaryPaymentMonth(s.payment_month); }} 
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" 
                            title="تعديل دفعة الراتب"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => setSalaryPaymentToDelete(s)} 
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" 
                            title="مسح دفعة الراتب"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {salaryPayments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400 py-8 text-xs font-bold">لا توجد دفعات رواتب مسددة سابقة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Advance Modal */}
        <Modal isOpen={showAdvanceForm} onClose={() => setShowAdvanceForm(false)} title="تسجيل سلفة جديدة للمدرب" footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={addAdvance} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">تسجيل السلفة</button>
            <button onClick={() => setShowAdvanceForm(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
          </div>
        }>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">مبلغ السلفة (ج.م) *</label>
              <input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-amber-500 focus:outline-none" placeholder="مثال: 500" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">سبب السلفة / ملاحظات</label>
              <input value={advanceNotes} onChange={(e) => setAdvanceNotes(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-amber-500 focus:outline-none" placeholder="مثال: سلفة طارئة" />
            </div>
          </div>
        </Modal>

        {/* Edit Base Salary Modal */}
        <Modal isOpen={showEditSalary} onClose={() => setShowEditSalary(false)} title="تعديل بيانات الراتب الأساسي والتخصص" footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={handleUpdateCoachSalary} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">حفظ التغييرات</button>
            <button onClick={() => setShowEditSalary(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
          </div>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الراتب الأساسي (ج.م) *</label>
              <input 
                type="number" 
                value={editSalaryValue} 
                onChange={(e) => setEditSalaryValue(e.target.value)} 
                className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" 
                placeholder="مثال: 3500"
                dir="ltr" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">التخصص / المسمى الوظيفي</label>
              <input 
                value={editSpecialization} 
                onChange={(e) => setEditSpecialization(e.target.value)} 
                className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" 
                placeholder="مثال: مدرب حراس مرمى" 
              />
            </div>
          </div>
        </Modal>

        {/* Salary Payment Modal */}
        <Modal isOpen={showSalaryForm} onClose={() => setShowSalaryForm(false)} title="صرف الراتب الشهرى" footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={addSalaryPayment} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">إتمام صرف الراتب</button>
            <button onClick={() => setShowSalaryForm(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
          </div>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ المكتوب للصرف (ج.م) *</label>
              <input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">عن الشهر المالي *</label>
              <input type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
        </Modal>

        {/* Edit Advance Modal */}
        <Modal isOpen={!!editingAdvance} onClose={() => setEditingAdvance(null)} title="تعديل بيانات السلفة" footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={handleUpdateAdvance} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">حفظ التغييرات</button>
            <button onClick={() => setEditingAdvance(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
          </div>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">مبلغ السلفة (ج.م) *</label>
              <input type="number" value={editAdvanceAmount} onChange={(e) => setEditAdvanceAmount(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">الملاحظات</label>
              <input value={editAdvanceNotes} onChange={(e) => setEditAdvanceNotes(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
        </Modal>

        {/* Edit Salary Payment Modal */}
        <Modal isOpen={!!editingSalaryPayment} onClose={() => setEditingSalaryPayment(null)} title="تعديل دفعة الراتب" footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={handleUpdateSalaryPayment} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">حفظ التغييرات</button>
            <button onClick={() => setEditingSalaryPayment(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
          </div>
        }>
          <div className="space-y-4 font-[Cairo]">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">المبلغ *</label>
              <input type="number" value={editSalaryPaymentAmount} onChange={(e) => setEditSalaryPaymentAmount(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">الشهر *</label>
              <input type="month" value={editSalaryPaymentMonth} onChange={(e) => setEditSalaryPaymentMonth(e.target.value)} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
        </Modal>

        {/* Confirm Delete Modals */}
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

  // -------------------------------------------------------------
  // Main Coaches Grid View
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in pb-12 font-[Cairo]">
      
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">فريق التدريب والمدربين</h2>
          <p className="text-slate-500 text-sm font-medium">إدارة رواتب المدربين والسلف وكشوفات الحساب بسهولة.</p>
        </div>
        <button 
          onClick={() => setShowAddCoach(true)}
          className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105"
        >
          <UserPlus size={18} />
          <span>+ إضافة مدرب جديد</span>
        </button>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 border-r-4 border-r-emerald-600 p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 mb-1 block">إجمالي المدربين النشطين</span>
            <div className="text-3xl font-black text-slate-900 font-tabular">{coaches.length} <span className="text-sm font-bold text-slate-500">مدرب</span></div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-r-4 border-r-blue-600 p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 mb-1 block">إجمالي كشف الرواتب الشهرية</span>
            <div className="text-3xl font-black text-blue-900 font-tabular">{formatMoney(totalSalariesBudget)} <span className="text-sm font-bold text-slate-500">ج.م</span></div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 mr-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم الكابتن، رقم الهاتف، التخصص، أو الفرع..."
          className="w-full border-none bg-transparent text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-lg"
          >
            مسح
          </button>
        )}
      </div>

      {/* Add Coach Modal */}
      <Modal isOpen={showAddCoach} onClose={() => setShowAddCoach(false)} title="إضافة كابتن مدرب جديد" footer={
        <div className="flex justify-end gap-2 w-full">
          <button onClick={handleAddCoach} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm">إضافة الكابتن</button>
          <button onClick={() => setShowAddCoach(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold cursor-pointer">إلغاء</button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">الاسم بالكامل *</label>
            <input value={newCoach.name} onChange={(e) => setNewCoach(f => ({...f, name: e.target.value}))} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" placeholder="مثال: كابتن أحمد حسن" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف *</label>
            <input value={newCoach.phone} onChange={(e) => setNewCoach(f => ({...f, phone: e.target.value}))} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" placeholder="01012345678" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">التخصص / المسمى الوظيفي</label>
            <input value={newCoach.specialization} onChange={(e) => setNewCoach(f => ({...f, specialization: e.target.value}))} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" placeholder="مثال: مدرب حراس مرمى" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">الراتب الأساسي الشهري (ج.م)</label>
            <input type="number" value={newCoach.salary} onChange={(e) => setNewCoach(f => ({...f, salary: e.target.value}))} className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-[Cairo] focus:border-emerald-500 focus:outline-none" placeholder="3000" dir="ltr" />
          </div>
        </div>
      </Modal>

      {/* Grid of Coaches */}
      {filteredCoaches.length === 0 ? (
        <EmptyState icon={<Users size={48} className="text-slate-300 mb-4" />} title="لا يوجد مدربين مطابقين" subtitle="قم بإضافة مدرب جديد أو تغيير عبارة البحث" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoaches.map(c => (
            <div 
              key={c.user_id} 
              onClick={() => openCoachDetail(c)}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all duration-200 cursor-pointer group flex flex-col justify-between hover:-translate-y-1 relative overflow-hidden"
            >
              
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex justify-center items-center font-black font-arabic text-xl shrink-0 shadow-md">
                      {(c.full_name || '👤').charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base group-hover:text-emerald-700 transition-colors">{c.full_name}</h4>
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 inline-block mt-0.5">
                        {c.specialization || 'مدرب فني'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details Pills */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  {c.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">رقم الهاتف:</span>
                      <span className="font-bold text-slate-800 dir-ltr">{c.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold">الفرع:</span>
                    {c.branch_name ? (
                      <BranchBadge branchId={c.branch_id || ''} branchName={c.branch_name} />
                    ) : (
                      <span className="text-slate-500 font-bold">جميع الفروع</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 font-bold">الراتب الأساسي:</span>
                    <span className="font-black text-slate-900 text-sm font-tabular">{formatMoney(c.base_salary)} <span className="text-xs font-bold text-emerald-700">ج.م</span></span>
                  </div>
                </div>
              </div>

              {/* Action Link Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                <span>عرض كشف الحساب والسلف ←</span>
                <span className="w-7 h-7 rounded-full bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
