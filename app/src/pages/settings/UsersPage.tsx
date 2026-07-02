import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import type { UserProfile, Branch } from '../../lib/types';

export default function UsersPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '', password: '', name: '', phone: '', role: 'coach', branch_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // 1. Get branches
    const { data: bData } = await supabase.from('branches').select('*').order('name');
    setBranches(bData || []);

    // 2. Get users with branch info
    const { data: uData } = await supabase
      .from('users')
      .select('*, branches(name)')
      .order('created_at', { ascending: false });

    const mapped = (uData || []).map((u: Record<string, unknown>) => ({
      ...u,
      branch_name: (u.branches as Record<string, string>)?.name,
    })) as unknown as UserProfile[];
    setUsers(mapped);
    setLoading(false);
  }

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase.from('users').update({ role }).eq('id', userId);
    if (error) { toast('error', 'خطأ في تحديث الصلاحية'); return; }
    toast('success', 'تم تحديث الصلاحية');
    loadData();
  }

  async function updateBranch(userId: string, branchId: string | null) {
    const { error } = await supabase.from('users').update({ branch_id: branchId }).eq('id', userId);
    if (error) { toast('error', 'خطأ في تحديث الفرع'); return; }
    toast('success', 'تم تحديث الفرع');
    loadData();
  }

  async function toggleActive(userId: string, currentStatus: boolean) {
    const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
    if (error) { toast('error', 'خطأ في تغيير حالة المستخدم'); return; }
    toast('success', 'تم تغيير حالة المستخدم');
    loadData();
  }

  async function deleteUser(id: string) {
    if (!window.confirm('هل أنت متأكد من مسح هذا المستخدم نهائياً؟')) return;
    
    // Try to delete from coaches first (foreign key)
    await supabase.from('coaches').delete().eq('user_id', id);
    
    // Then delete from users
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') { // Foreign key violation
        toast('error', 'لا يمكن مسح هذا المستخدم لارتباطه بتسجيل مصروفات أو إيرادات. يرجى تعطيله بدلاً من مسحه للحفاظ على الحسابات.');
      } else {
        toast('error', 'حدث خطأ أثناء مسح المستخدم');
      }
      return;
    }
    toast('success', 'تم مسح المستخدم بنجاح');
    loadData();
  }

  async function handleAddUser() {
    if (isSaving) return;
    if (!newUser.name || !newUser.phone || !newUser.email || !newUser.password) {
      toast('error', 'يرجى إدخال جميع البيانات المطلوبة');
      return;
    }
    
    setIsSaving(true);
    
    // Create a secondary client to sign up the new user without logging the current admin out
    const adminAuthClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await adminAuthClient.auth.signUp({
      email: newUser.email,
      password: newUser.password,
    });

    if (authError) {
      toast('error', authError.message === 'User already registered' ? 'هذا البريد الإلكتروني مسجل بالفعل' : 'حدث خطأ في إنشاء الحساب');
      setIsSaving(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      toast('error', 'حدث خطأ غير معروف');
      setIsSaving(false);
      return;
    }

    // Insert into public.users
    const { error: dbError } = await supabase.from('users').insert({
      id: userId,
      full_name: newUser.name,
      phone: newUser.phone,
      role: newUser.role,
      branch_id: newUser.branch_id || null,
      is_active: true
    });

    if (dbError) {
      toast('error', 'تم إنشاء الحساب ولكن حدث خطأ في حفظ البيانات الإضافية');
      console.error(dbError);
    } else {
      toast('success', 'تم إضافة المستخدم بنجاح');
      
      // If coach, add to coaches table
      if (newUser.role === 'coach') {
        await supabase.from('coaches').insert({ user_id: userId });
      }
    }

    setShowForm(false);
    setNewUser({ email: '', password: '', name: '', phone: '', role: 'coach', branch_id: '' });
    setIsSaving(false);
    loadData();
  }

  // Security check: Only owner should be here (handled by router, but good to check)
  if (profile?.role !== 'owner') {
    return <EmptyState icon="🚫" title="غير مصرح" subtitle="ليس لديك صلاحية للوصول إلى هذه الصفحة" />;
  }

  if (loading) return <PageLoading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-slate-500">إدارة صلاحيات المستخدمين والفروع المخصصة لهم.</p>
        <button onClick={() => setShowForm(true)} className="py-2 px-4 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-emerald-700">
          ℹ️ كيفية إضافة مستخدم؟
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الاسم / الهاتف</th>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">البريد الإلكتروني</th>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الصلاحية</th>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الفرع</th>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الحالة</th>
                <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic text-left">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-75 bg-slate-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 font-arabic flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
                        {u.full_name.charAt(0)}
                      </div>
                      <div>
                        <div>{u.full_name}</div>
                        <div className="text-xs text-slate-400 font-tabular font-medium mt-0.5" dir="ltr">{u.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{u.email}</td>
                  <td className="px-6 py-4">
                    {u.id === profile.id ? (
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 font-arabic">مالك النظام</span>
                    ) : (
                      <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}
                        className="py-1 px-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none bg-slate-50 font-arabic font-bold text-slate-700">
                        <option value="owner">المالك</option>
                        <option value="admin">مشرف فرع</option>
                        <option value="coach">مدرب</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'owner' ? (
                      <span className="text-sm font-bold text-slate-400 font-arabic">كل الفروع</span>
                    ) : (
                      <select value={u.branch_id || ''} onChange={(e) => updateBranch(u.id, e.target.value || null)}
                        className="py-1 px-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none bg-slate-50 font-arabic font-bold text-slate-700">
                        <option value="">بدون فرع</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.id === profile.id ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 font-arabic">نشط</span>
                      ) : (
                        <button onClick={() => toggleActive(u.id, u.is_active)}
                          className={`px-3 py-1 text-xs font-bold rounded-full border cursor-pointer font-arabic transition-colors ${u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                          {u.is_active ? 'نشط' : 'غير نشط'}
                        </button>
                      )}
                      
                      {u.id !== profile.id && (
                        <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="مسح المستخدم">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-medium font-tabular text-left">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="إضافة مستخدم جديد" footer={
        <>
          <button onClick={handleAddUser} disabled={isSaving} className="btn btn-primary px-6 disabled:opacity-50">
            {isSaving ? 'جاري الحفظ...' : 'حفظ المستخدم'}
          </button>
          <button onClick={() => setShowForm(false)} disabled={isSaving} className="btn btn-secondary px-6 disabled:opacity-50">إلغاء</button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="form-label">الاسم بالكامل *</label>
            <input value={newUser.name} onChange={e => setNewUser(x => ({...x, name: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="form-label">رقم الهاتف *</label>
            <input value={newUser.phone} onChange={e => setNewUser(x => ({...x, phone: e.target.value}))} className="input-field" dir="ltr" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">البريد الإلكتروني (للدخول) *</label>
              <input type="email" value={newUser.email} onChange={e => setNewUser(x => ({...x, email: e.target.value}))} className="input-field" dir="ltr" />
            </div>
            <div>
              <label className="form-label">كلمة المرور *</label>
              <input type="text" value={newUser.password} onChange={e => setNewUser(x => ({...x, password: e.target.value}))} className="input-field" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">الصلاحية</label>
              <select value={newUser.role} onChange={e => setNewUser(x => ({...x, role: e.target.value}))} className="input-field">
                <option value="coach">مدرب (Coach)</option>
                <option value="admin">مشرف (Admin)</option>
              </select>
            </div>
            <div>
              <label className="form-label">الفرع التابع له</label>
              <select value={newUser.branch_id} onChange={e => setNewUser(x => ({...x, branch_id: e.target.value}))} className="input-field">
                <option value="">كل الفروع (إدارة عامة)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
