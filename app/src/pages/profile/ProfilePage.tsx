import { useState } from 'react';
import { User, Lock, Save, Eye, EyeOff, Shield, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';

export default function ProfilePage() {
  const { profile, session } = useAuth();
  const { branches } = useBranch();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // Edit profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const roleLabels: Record<string, string> = {
    owner: 'المالك',
    admin: 'المشرف',
    coach: 'المدرب',
  };

  const branchName = branches.find(b => b.id === profile?.branch_id)?.name || 'كل الفروع';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast('error', 'يرجى إدخال الاسم');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', profile!.id);

      if (error) {
        toast('error', 'حدث خطأ في تحديث البيانات');
        console.error(error);
      } else {
        toast('success', 'تم تحديث البيانات بنجاح');
      }
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
      if (error) {
        toast('error', error.message || 'حدث خطأ في تغيير كلمة المرور');
      } else {
        toast('success', 'تم تغيير كلمة المرور بنجاح');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-800">حسابي</h1>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="p-8" style={{ background: 'linear-gradient(135deg, #14532d, #166534)' }}>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-emerald-400/20 border-2 border-emerald-300 rounded-full flex items-center justify-center text-4xl shrink-0">
              <span className="font-bold text-emerald-100">
                {profile?.full_name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold mb-1">{profile?.full_name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-emerald-200 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Shield size={14} />
                  {roleLabels[profile?.role || 'coach']}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={14} />
                  {session?.user?.email || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {branchName}
                </span>
                {profile?.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={14} />
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 max-w-md">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo] flex items-center justify-center gap-2
            ${activeTab === 'info' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User size={16} />
          البيانات الشخصية
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo] flex items-center justify-center gap-2
            ${activeTab === 'password' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Lock size={16} />
          تغيير كلمة المرور
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'info' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">
              تعديل البيانات الشخصية
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Read-only email */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  البريد الإلكتروني
                  <span className="text-xs text-slate-400 font-normal mr-2">(لا يمكن تغييره)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-slate-400" />
                  <input
                    type="email"
                    value={session?.user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Editable name */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">الاسم الكامل *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
                  placeholder="أدخل اسمك الكامل"
                />
              </div>

              {/* Editable phone */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">رقم الهاتف</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              {/* Read-only role */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  الدور
                  <span className="text-xs text-slate-400 font-normal mr-2">(يتم تغييره من المالك)</span>
                </label>
                <input
                  type="text"
                  value={roleLabels[profile?.role || 'coach']}
                  disabled
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Save size={18} />
                  {savingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">
              تغيير كلمة المرور
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* New password */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
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

              {/* Confirm password */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">تأكيد كلمة المرور *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
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
                  <p className="text-red-500 text-xs font-semibold mt-1">كلمة المرور وتأكيدها غير متطابقين</p>
                )}
              </div>

              {/* Password strength hint */}
              {newPassword && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="text-sm font-bold text-slate-600 mb-2">قوة كلمة المرور:</div>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          newPassword.length >= level * 3
                            ? level <= 1 ? 'bg-red-400' : level <= 2 ? 'bg-yellow-400' : level <= 3 ? 'bg-blue-400' : 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li className={newPassword.length >= 6 ? 'text-emerald-600' : ''}>
                      {newPassword.length >= 6 ? '✓' : '○'} 6 أحرف على الأقل
                    </li>
                    <li className={newPassword.length >= 8 ? 'text-emerald-600' : ''}>
                      {newPassword.length >= 8 ? '✓' : '○'} 8 أحرف أو أكثر (مستحسن)
                    </li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-emerald-600' : ''}>
                      {/[0-9]/.test(newPassword) ? '✓' : '○'} يحتوي على أرقام
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Lock size={18} />
                  {savingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
