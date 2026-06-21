import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Shield, User, LogOut } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className="min-h-screen w-full flex bg-white font-arabic" dir="rtl">
      
      {/* Right Side: Information / Branding */}
      <div className="hidden lg:flex w-1/2 bg-[#064e3b] text-white flex-col justify-center relative overflow-hidden">
        {/* Background Image - Clean and Visible */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
          style={{ backgroundImage: "url('/football_player_bg_1781904252945.png')" }}
        ></div>
        {/* Soft dark gradient from the bottom so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-900/80 to-transparent"></div>
        
        <div className="relative z-10 max-w-lg mx-auto text-center px-8 flex flex-col gap-12 mt-16">
          <div className="flex flex-col items-center justify-center gap-4">
            <Shield size={64} className="text-emerald-400 drop-shadow-lg mb-2" strokeWidth={1.5} />
            <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-md">أكاديمية VFC</h1>
            <p className="text-xl leading-relaxed text-emerald-100 mt-4 drop-shadow">
              نظام الإدارة المتكامل لتطوير المواهب الكروية والتميز الرياضي بمعايير عالمية.
            </p>
          </div>
          
          <div className="flex flex-col gap-5 text-right items-start">
            <div className="flex items-center gap-4 text-emerald-50 backdrop-blur-md bg-black/20 p-5 rounded-2xl border border-white/10 w-full hover:bg-black/30 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                <Shield size={22} className="text-emerald-300" />
              </div>
              <span className="text-lg font-bold">إدارة احترافية للاعبين والفرق</span>
            </div>
            <div className="flex items-center gap-4 text-emerald-50 backdrop-blur-md bg-black/20 p-5 rounded-2xl border border-white/10 w-full hover:bg-black/30 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                <Shield size={22} className="text-emerald-300" />
              </div>
              <span className="text-lg font-bold">تقارير أداء دقيقة ومتابعة مستمرة</span>
            </div>
            <div className="flex items-center gap-4 text-emerald-50 backdrop-blur-md bg-black/20 p-5 rounded-2xl border border-white/10 w-full hover:bg-black/30 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                <Shield size={22} className="text-emerald-300" />
              </div>
              <span className="text-lg font-bold">نظام مالي وإداري مؤتمت بالكامل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side: Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-16 relative z-10 overflow-y-auto">
        <div className="w-full max-w-[420px] animate-fade-in flex flex-col gap-8 my-auto">
          
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">تسجيل الدخول</h2>
            <p className="text-slate-500 font-medium text-lg mt-1">الرجاء إدخال بياناتك للوصول إلى لوحة التحكم</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm font-bold w-full p-4 rounded-xl border border-red-200 flex items-center gap-3 shadow-sm">
              <span className="text-lg flex-shrink-0">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
            
            <div className="flex flex-col gap-2 w-full">
              <label className="block text-slate-700 text-sm font-bold text-right">البريد الإلكتروني أو اسم المستخدم</label>
              <div className="relative flex items-center w-full">
                <div className="absolute right-4 text-slate-400 z-10 pointer-events-none">
                  <User size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@vfc.com"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-right font-medium outline-none"
                  style={{ padding: '16px 48px 16px 16px' }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="block text-slate-700 text-sm font-bold text-right">كلمة المرور</label>
              <div className="relative flex items-center w-full">
                <div className="absolute right-4 text-slate-400 z-10 pointer-events-none">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-right font-medium outline-none"
                  style={{ padding: '16px 48px 16px 16px' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <a href="#" className="text-emerald-700 font-bold hover:text-emerald-800 text-sm transition-colors">نسيت كلمة المرور؟</a>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-semibold group">
                <span className="text-sm select-none">تذكرني</span>
                <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 w-4 h-4 cursor-pointer" />
              </label>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-600/30 flex items-center justify-center gap-3 border border-transparent"
              >
                تسجيل الدخول <LogOut size={20} className="rotate-180" />
              </button>
            </div>
          </form>

          {/* Copyright text */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center w-full">
            <p className="text-slate-400 text-sm font-semibold">
              © 2024 أكاديمية VFC. جميع الحقوق محفوظة.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
