import { useState, useEffect, useCallback } from 'react';
import { Building2, MapPin, Shield, CreditCard, Save, Trash2, UserPlus, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';

interface BranchItem {
  id: string;
  name: string;
  closing_day: number;
  created_at?: string;
}

interface SystemUser {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role?: string;
  branch_id?: string;
  created_at?: string;
  branches?: { name: string };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'branches' | 'security' | 'billing'>('branches');
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Academy General Data
  const [generalData, setGeneralData] = useState(() => {
    const saved = localStorage.getItem('vfc_academy_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      academyName: 'أكاديمية VFC لكرة القدم',
      email: 'contact@vfc-academy.com',
      phone: '01000000000',
      address: 'القاهرة، جمهورية مصر العربية',
      currency: 'ج.م',
    };
  });

  // Branch Edit Modal State
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [editClosingDay, setEditClosingDay] = useState('20');
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  // Add Branch Modal State
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchClosingDay, setNewBranchClosingDay] = useState('20');

  // User Deletion State
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Add User State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'coach',
    branch_id: '',
  });

  // Load branches
  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('created_at');
    if (data) setBranches(data);
  }, []);

  // Load system users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from('users')
      .select('*, branches(name)')
      .order('created_at', { ascending: false });
    setSystemUsers((data as SystemUser[]) || []);
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, [loadBranches, loadUsers]);

  // Save General Academy Settings
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('vfc_academy_settings', JSON.stringify(generalData));
    toast('success', 'تم حفظ إعدادات الأكاديمية بنجاح ✅');
  };

  // Open Edit Branch Closing Day Modal
  const openEditBranch = (b: BranchItem) => {
    setEditingBranch(b);
    setEditClosingDay(String(b.closing_day ?? 20));
  };

  // Save Branch Closing Day
  const handleSaveBranchClosingDay = async () => {
    if (!editingBranch) return;
    const dayNum = parseInt(editClosingDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      toast('error', 'يرجى إدخال يوم تقفيل صحيح بين 1 و 31');
      return;
    }

    setIsSavingBranch(true);
    try {
      const { error } = await supabase
        .from('branches')
        .update({ closing_day: dayNum })
        .eq('id', editingBranch.id);

      if (error) throw error;

      toast('success', `تم تحديث يوم تقفيل فرع (${editingBranch.name}) إلى يوم ${dayNum} في الشهر بنجاح ✅`);
      setEditingBranch(null);
      loadBranches();
    } catch (err: any) {
      toast('error', 'حدث خطأ في التحديث: ' + err.message);
    } finally {
      setIsSavingBranch(false);
    }
  };

  // Save New Branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast('error', 'يرجى إدخال اسم الفرع');
      return;
    }
    const dayNum = parseInt(newBranchClosingDay, 10) || 20;

    try {
      const { error } = await supabase.from('branches').insert({
        name: newBranchName.trim(),
        closing_day: dayNum,
      });

      if (error) throw error;

      toast('success', `تم إنشاء فرع (${newBranchName}) يوم تقفيل ${dayNum} بنجاح ✅`);
      setShowAddBranchModal(false);
      setNewBranchName('');
      setNewBranchClosingDay('20');
      loadBranches();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء إضافة الفرع: ' + err.message);
    }
  };

  // Delete User Permanently
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const { error } = await supabase.from('users').delete().eq('id', userToDelete.id);
      if (error) throw error;

      toast('success', `تم حذف المستخدم (${userToDelete.full_name}) نهائياً من النظام ✅`);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء حذف المستخدم: ' + err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Add System User
  const handleAddUser = async () => {
    if (!newUser.full_name.trim()) {
      toast('error', 'يرجى إدخال اسم المستخدم');
      return;
    }

    try {
      const { error } = await supabase.from('users').insert({
        full_name: newUser.full_name.trim(),
        phone: newUser.phone.trim() || null,
        role: newUser.role,
        branch_id: newUser.branch_id || null,
        is_active: true,
      });

      if (error) throw error;

      toast('success', `تم إضافة المستخدم (${newUser.full_name}) بنجاح ✅`);
      setShowAddUserModal(false);
      setNewUser({ full_name: '', email: '', phone: '', role: 'coach', branch_id: '' });
      loadUsers();
    } catch (err: any) {
      toast('error', 'حدث خطأ في إضافة المستخدم: ' + err.message);
    }
  };

  // Helper to explain closing day rule
  const getClosingDayExplanation = (closingDay: number) => {
    const nextStartDay = closingDay >= 31 ? 1 : closingDay + 1;
    return `الدورة المالية تنتهي يوم ${closingDay} في الشهر. الدفعات أو اللاعبون المسجلون بعد يوم ${closingDay} (من يوم ${nextStartDay}) يُحسبون تلقائياً للشهر المالي الجديد.`;
  };

  return (
    <div className="space-y-6 animate-fade-in font-[Cairo] pb-12">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">⚙️ إعدادات النظام</h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">
          إدارة إعدادات الأكاديمية، تواريخ التقفيل المالي للفروع، والأمان والصلاحيات
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-2 space-y-1">
            <button
              onClick={() => setActiveTab('branches')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-right transition-all cursor-pointer font-extrabold text-sm ${
                activeTab === 'branches' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapPin size={20} />
              إدارة الفروع وتاريخ التقفيل
            </button>

            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-right transition-all cursor-pointer font-extrabold text-sm ${
                activeTab === 'general' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 size={20} />
              بيانات الأكاديمية
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-right transition-all cursor-pointer font-extrabold text-sm ${
                activeTab === 'security' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Shield size={20} />
              الأمان والصلاحيات والغياب
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-right transition-all cursor-pointer font-extrabold text-sm ${
                activeTab === 'billing' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard size={20} />
              الاشتراك والفوترة
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          
          {/* TAB 1: BRANCHES & CLOSING DAYS */}
          {activeTab === 'branches' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">إدارة الفروع وتاريخ تقفيل الشهر</h2>
                  <p className="text-xs font-bold text-slate-500 mt-1">تحديد يوم التقفيل المالي لكل فرع لضبط حسابات الشهور التلقائية</p>
                </div>
                <button 
                  onClick={() => setShowAddBranchModal(true)}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-extrabold text-sm hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  + إضافة فرع جديد
                </button>
              </div>

              {/* Explanation Alert */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-900 text-xs md:text-sm font-bold">
                <Info size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-emerald-950 text-sm mb-1">💡 كيف يعمل يوم تقفيل الشهر في النظام؟</div>
                  <div>
                    كل فرع له يوم تقفيل شهري محدد (مثل <strong>يوم 20 لفرع الثلاثي</strong>). 
                    أي تسجيل للاعب جديد أو عملية دفع تتم بعد يوم التقفيل تُحسب مباشرةً لحساب <strong>الشهر المالي القادم</strong> دون أي تدخل يدوي!
                  </div>
                </div>
              </div>

              {/* Branch Cards Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-slate-700 font-extrabold text-sm">اسم الفرع</th>
                        <th className="px-6 py-4 text-slate-700 font-extrabold text-sm">يوم تقفيل الشهر</th>
                        <th className="px-6 py-4 text-slate-700 font-extrabold text-sm hidden md:table-cell">شرح الدورة المالية</th>
                        <th className="px-6 py-4 text-slate-700 font-extrabold text-sm text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {branches.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold">لا يوجد فروع مسجلة. قم بإضافة فرع جديد.</td></tr>
                      ) : (
                        branches.map(b => {
                          const cd = b.closing_day ?? 20;
                          return (
                            <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-5 font-extrabold text-slate-900 text-base">{b.name}</td>
                              <td className="px-6 py-5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs md:text-sm font-extrabold border border-emerald-200 font-tabular">
                                  📅 يوم {cd} في الشهر
                                </span>
                              </td>
                              <td className="px-6 py-5 text-xs text-slate-500 font-semibold leading-relaxed hidden md:table-cell max-w-xs">
                                {getClosingDayExplanation(cd)}
                              </td>
                              <td className="px-6 py-5 text-center">
                                <button 
                                  onClick={() => openEditBranch(b)}
                                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-extrabold text-xs md:text-sm transition-all border border-blue-200 cursor-pointer shadow-2xs hover:scale-105"
                                >
                                  ✏️ تعديل يوم التقفيل
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMY GENERAL DATA */}
          {activeTab === 'general' && (
            <div className="animate-fade-in space-y-6">
              <h2 className="text-xl font-extrabold text-slate-900 pb-4 border-b border-slate-100">البيانات الأساسية للأكاديمية</h2>
              
              <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-extrabold text-slate-700">اسم الأكاديمية</label>
                    <input
                      type="text"
                      value={generalData.academyName}
                      onChange={(e) => setGeneralData({...generalData, academyName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-extrabold text-slate-700">البريد الإلكتروني الرسمي</label>
                    <input
                      type="email"
                      value={generalData.email}
                      onChange={(e) => setGeneralData({...generalData, email: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-extrabold text-slate-700">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={generalData.phone}
                      onChange={(e) => setGeneralData({...generalData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-extrabold text-slate-700">العملة الافتراضية</label>
                    <select
                      value={generalData.currency}
                      onChange={(e) => setGeneralData({...generalData, currency: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold cursor-pointer"
                    >
                      <option value="ج.م">الجنيه المصري (ج.م)</option>
                      <option value="SAR">الريال السعودي (SAR)</option>
                      <option value="USD">الدولار الأمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-extrabold text-slate-700">العنوان الرئيسي</label>
                    <input
                      type="text"
                      value={generalData.address}
                      onChange={(e) => setGeneralData({...generalData, address: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button type="submit" className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer hover:scale-105">
                    <Save size={20} />
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SECURITY, PERMISSIONS & PERMANENT USER DELETION */}
          {activeTab === 'security' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">الأمان وإدارة مستخدمي النظام</h2>
                  <p className="text-xs font-bold text-slate-500 mt-1">عرض جميع المستخدمين والمدربين وإمكانية حذف أي مستخدم نهائياً</p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-extrabold text-sm hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus size={18} />
                  + إضافة مستخدم جديد
                </button>
              </div>

              {/* Users List Table */}
              {loadingUsers ? (
                <div className="text-center py-8 text-slate-400 font-bold">جاري تحميل مستخدمي النظام...</div>
              ) : systemUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold">لا يوجد مستخدمين مسجلين حالياً.</div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-slate-700 font-extrabold text-sm">الاسم</th>
                          <th className="px-6 py-4 text-slate-700 font-extrabold text-sm">الدور (الصلاحية)</th>
                          <th className="px-6 py-4 text-slate-700 font-extrabold text-sm hidden md:table-cell">الفرع</th>
                          <th className="px-6 py-4 text-slate-700 font-extrabold text-sm hidden sm:table-cell">رقم الهاتف</th>
                          <th className="px-6 py-4 text-slate-700 font-extrabold text-sm text-center">حذف نهائي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {systemUsers.map(user => {
                          const roleName = user.role === 'owner' ? '👑 المالك' : user.role === 'admin' ? '⚙️ مشرف' : '⚽ مدرب';
                          const isOwner = user.role === 'owner';
                          return (
                            <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-4 font-extrabold text-slate-900 text-sm md:text-base">
                                {user.full_name}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${
                                  isOwner ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {roleName}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs md:text-sm font-bold text-slate-500 hidden md:table-cell">
                                {user.branches?.name || 'كل الفروع'}
                              </td>
                              <td className="px-6 py-4 text-xs md:text-sm font-mono font-bold text-slate-600 hidden sm:table-cell dir-ltr text-right">
                                {user.phone || '—'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {isOwner ? (
                                  <span className="text-xs text-slate-400 font-bold">محمي 🔒</span>
                                ) : (
                                  <button
                                    onClick={() => setUserToDelete(user)}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-extrabold text-xs transition-all border border-rose-200 flex items-center gap-1 mx-auto cursor-pointer hover:scale-105 active:scale-95"
                                  >
                                    <Trash2 size={14} />
                                    حذف نهائياً
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BILLING */}
          {activeTab === 'billing' && (
            <div className="animate-fade-in space-y-6">
              <h2 className="text-xl font-extrabold text-slate-900 pb-4 border-b border-slate-100">الاشتراك والفوترة</h2>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-950 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-lg">باقة الأكاديمية الاحترافية (VFC Enterprise)</span>
                  <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-extrabold">نشط ✅</span>
                </div>
                <p className="text-sm font-bold text-emerald-800">تغطية شاملة لجميع الفروع والدورات المالية وحسابات اللاعبين والمدربين والمخزون مع مزامنة فواتير تلقائية.</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Edit Branch Closing Day Modal */}
      <Modal
        isOpen={!!editingBranch}
        onClose={() => setEditingBranch(null)}
        title={`✏️ تعديل يوم التقفيل لفرع (${editingBranch?.name || ''})`}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSaveBranchClosingDay}
              disabled={isSavingBranch}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSavingBranch ? '⏳ جاري الحفظ...' : 'حفظ يوم التقفيل ✅'}
            </button>
            <button
              onClick={() => setEditingBranch(null)}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900 text-xs md:text-sm font-bold leading-relaxed">
            <strong>ملاحظة هامة:</strong> تغيير يوم التقفيل سيؤثر مباشرة على حساب الدورة المالية التلقائية للاعبين والدفعات المستحدثة لفرع ({editingBranch?.name}).
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-2">اختر يوم التقفيل في الشهر (من 1 إلى 31) *</label>
            <input
              type="number"
              min="1"
              max="31"
              value={editClosingDay}
              onChange={(e) => setEditClosingDay(e.target.value)}
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-base font-extrabold focus:border-emerald-500 focus:outline-none font-tabular"
              dir="ltr"
            />
          </div>

          {editClosingDay && !isNaN(parseInt(editClosingDay)) && (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs md:text-sm font-bold text-emerald-900">
              📌 {getClosingDayExplanation(parseInt(editClosingDay))}
            </div>
          )}
        </div>
      </Modal>

      {/* Add Branch Modal */}
      <Modal
        isOpen={showAddBranchModal}
        onClose={() => setShowAddBranchModal(false)}
        title="➕ إضافة فرع جديد للأكاديمية"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCreateBranch}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all cursor-pointer shadow-sm"
            >
              إضافة الفرع ✅
            </button>
            <button
              onClick={() => setShowAddBranchModal(false)}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-2">اسم الفرع الجديد *</label>
            <input
              type="text"
              placeholder="مثال: فرع التجمع الخامس"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-2">يوم تقفيل الشهر المالي *</label>
            <input
              type="number"
              min="1"
              max="31"
              value={newBranchClosingDay}
              onChange={(e) => setNewBranchClosingDay(e.target.value)}
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none font-tabular"
              dir="ltr"
            />
          </div>
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="👤 إضافة مستخدم جديد للنظام"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleAddUser}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all cursor-pointer shadow-sm"
            >
              إضافة المستخدم ✅
            </button>
            <button
              onClick={() => setShowAddUserModal(false)}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1">الاسم الكامل *</label>
            <input
              type="text"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: كابتن أحمد محمود"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1">رقم الهاتف</label>
            <input
              type="tel"
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none"
              placeholder="01xxxxxxxxx"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1">الدور (الصلاحية)</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="coach">⚽ مدرب</option>
                <option value="admin">⚙️ مشرف فرع</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1">الفرع</label>
              <select
                value={newUser.branch_id}
                onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })}
                className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="">كل الفروع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Permanent User Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteUser}
        title="⚠️ حذف مستخدم نهائياً"
        message={`هل أنت متأكد من حذف المستخدم (${userToDelete?.full_name}) نهائياً من قاعدة البيانات؟\n\nلا يمكن التراجع عن هذا الإجراء وسيتم إلغاء وصوله للنظام نهائياً!`}
        confirmText={isDeletingUser ? 'جاري الحذف...' : 'حذف نهائياً 🗑️'}
        variant="danger"
      />
    </div>
  );
}
