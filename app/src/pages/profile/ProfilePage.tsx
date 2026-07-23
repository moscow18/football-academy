import { useState, useEffect } from 'react';
import { User, Lock, Save, Eye, EyeOff, Phone, Mail, MapPin, Crown, CheckCircle2, Building2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';

export default function ProfilePage() {
  const { profile, session } = useAuth();
  const { branches } = useBranch();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // Stats
  const [activePlayersCount, setActivePlayersCount] = useState(0);

  // Edit profile state
  const [fullName, setFullName] = useState(profile?.full_name || 'كابتن رامي');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile]);

  useEffect(() => {
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'active')
      .then(({ count }) => setActivePlayersCount(count || 0));
  }, []);

  const roleLabels: Record<string, string> = {
    owner: 'المالك والمدير العام 👑',
    admin: 'المشرف العام',
    coach: 'المدرب الفني',
  };

  const branchName = branches.find(b => b.id === profile?.branch_id)?.name || 'جميع الفروع الأكاديمية';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast('error', 'يرجى إدخال الاسم الكامل');
      return;
    }

    setSavingProfile(true);
    try {
      if (profile?.id) {
        const { error } = await supabase
          .from('users')
          .update({ full_name: fullName.trim(), phone: phone.trim() || null })
          .eq('id', profile.id);

        if (error) throw error;
      }
      toast('success', 'تم تحديث بيانات الملف الشخصي بنجاح ✅');
    } catch (err: any) {
      toast('error', 'حدث خطأ أثناء حفظ البيانات: ' + (err.message || ''));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('error', 'كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast('success', 'تم تغيير كلمة المرور بنجاح ✅');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast('error', err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in font-[Cairo] pb-12">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
          👤 الملف الشخصي للـ حساب
        </h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">
          إدارة بيانات الحساب الشخصي، كلمات المرور وصلاحيات المالك
        </p>
      </div>

      {/* Premium Profile Hero Banner */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="p-6 md:p-8" style={{ background: 'linear-gradient(135deg, #064e3b, #047857)' }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-right">
            {/* Avatar Circle */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-amber-200 border-4 border-white/20 rounded-full flex items-center justify-center text-4xl font-extrabold text-emerald-950 shadow-xl">
                {fullName.charAt(0) || 'ك'}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-lg border-2 border-white" title="مالك الأكاديمية">
                <Crown size={16} strokeWidth={2.5} />
              </div>
            </div>

            {/* Main Info */}
            <div className="text-white flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{fullName}</h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1">
                  <Crown size={14} /> {roleLabels[profile?.role || 'owner']}
                </span>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 text-emerald-100 text-xs md:text-sm font-bold pt-1">
                <span className="inline-flex items-center gap-1.5 bg-emerald-800/40 px-3 py-1 rounded-lg border border-emerald-700/50">
                  <Mail size={15} /> {session?.user?.email || 'ramycaptain@gmail.com'}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-emerald-800/40 px-3 py-1 rounded-lg border border-emerald-700/50">
                  <Building2 size={15} /> {branchName}
                </span>
                {phone && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-800/40 px-3 py-1 rounded-lg border border-emerald-700/50 dir-ltr">
                    <Phone size={15} /> {phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700 font-extrabold">حالة الحساب</span>
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-900">نشط (صلاحيات مالك كاملة)</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-700 font-extrabold">الفروع التابعة</span>
            <MapPin size={20} className="text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-900 font-tabular">{branches.length} <span className="text-xs">فروع</span></div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-700 font-extrabold">اللاعبين المشتركين</span>
            <Users size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-900 font-tabular">{activePlayersCount} <span className="text-xs">لاعب</span></div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 max-w-md">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 px-4 rounded-lg font-extrabold text-sm transition-all cursor-pointer border-none font-[Cairo] flex items-center justify-center gap-2 ${
            activeTab === 'info' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <User size={18} />
          البيانات الشخصية
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-3 px-4 rounded-lg font-extrabold text-sm transition-all cursor-pointer border-none font-[Cairo] flex items-center justify-center gap-2 ${
            activeTab === 'password' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Lock size={18} />
          تغيير كلمة المرور
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'info' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-3xl">
            <h3 className="text-xl font-extrabold text-slate-900 mb-6 pb-4 border-b border-slate-100">
              تعديل بيانات الحساب الشخصي
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Read-only email */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">
                  البريد الإلكتروني المسجل
                  <span className="text-xs text-slate-400 font-bold mr-2">(مفتاح تسجيل الدخول)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email"
                    value={session?.user?.email || 'ramycaptain@gmail.com'}
                    disabled
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold cursor-not-allowed text-right dir-ltr"
                  />
                </div>
              </div>

              {/* Editable Name */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">الاسم الكامل *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold text-base"
                  placeholder="أدخل الاسم الكامل"
                />
              </div>

              {/* Editable Phone */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">رقم الهاتف التواصل</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold text-base dir-ltr text-right"
                  placeholder="01xxxxxxxxx"
                />
              </div>

              {/* Read-only Role Badge */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">نوع الصلاحية بالحساب</label>
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-extrabold text-sm flex items-center justify-between">
                  <span>👑 مالك ومدير الأكاديمية (صلاحيات إدارة ومالية كاملة)</span>
                  <span className="bg-amber-200 text-amber-900 px-3 py-1 rounded-lg text-xs">كاملة ✅</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95 text-base"
                >
                  <Save size={20} />
                  {savingProfile ? 'جاري الحفظ...' : 'حفظ بيانات الملف الشخصي ✅'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl">
            <h3 className="text-xl font-extrabold text-slate-900 mb-6 pb-4 border-b border-slate-100">
              تغيير كلمة المرور بشكل آمن
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* New Password */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold"
                    placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                    dir="ltr"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-1"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-700">تأكيد كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 font-bold"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    dir="ltr"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-rose-600 text-xs font-extrabold mt-1">⚠️ كلمة المرور وتأكيدها غير متطابقين</p>
                )}
              </div>

              {/* Password strength meter */}
              {newPassword && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <div className="text-xs font-extrabold text-slate-600">مقياس أمان كلمة المرور:</div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className={`h-2 flex-1 rounded-full transition-all ${
                          newPassword.length >= level * 3
                            ? level <= 1 ? 'bg-red-500' : level <= 2 ? 'bg-amber-500' : level <= 3 ? 'bg-blue-500' : 'bg-emerald-600'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer hover:scale-105"
                >
                  <Lock size={18} />
                  {savingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور ✅'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
