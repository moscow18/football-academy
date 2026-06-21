import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { MapPin, Menu, User } from 'lucide-react';
import { Link } from 'react-router-dom';
interface TopBarProps {
  title: string;
  onMenuToggle: () => void;
}

export default function TopBar({ title, onMenuToggle }: TopBarProps) {
  const { profile } = useAuth();
  const { branches, selectedBranchId, setBranchId } = useBranch();

  const isOwner = profile?.role === 'owner';

  const roleLabels: Record<string, string> = {
    owner: 'المالك',
    admin: 'المشرف',
    coach: 'المدرب',
  };

  return (
    <div className="bg-white px-8 py-4 flex items-center justify-between border-b border-slate-200 z-30 h-20 sticky top-0">
      
      {/* Right: Title & Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="md:hidden border border-slate-200 rounded-lg cursor-pointer text-slate-600 p-2 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Menu size={20} />
        </button>
        <h3 className="text-2xl font-extrabold text-emerald-800 font-arabic tracking-tight">{title}</h3>
      </div>

      {/* Middle: Links */}
      <div className="hidden md:flex items-center gap-8 font-arabic font-bold text-slate-500">
        <Link to="/" className="text-emerald-700 border-b-2 border-emerald-700 pb-1">الرئيسية</Link>
        <Link to="/settings" className="hover:text-slate-800 transition-colors">الإعدادات</Link>
      </div>

      {/* Left: Actions & Profile */}
      <div className="flex items-center gap-5">
        
        {/* Branch Selector (if Owner) */}
        {isOwner && (
          <div className="relative hidden md:block border-r border-slate-200 pr-5">
            <select
              value={selectedBranchId || ''}
              onChange={(e) => setBranchId(e.target.value || null)}
              className="appearance-none pr-8 pl-4 py-2 rounded-lg border-none bg-transparent font-arabic text-sm font-bold text-slate-600 cursor-pointer focus:outline-none"
            >
              <option value="">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <MapPin size={16} />
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 border-r border-slate-200 pr-5 ml-2">
          <div className="text-left hidden sm:block">
            <div className="text-sm font-bold text-slate-800 font-arabic leading-tight">{profile?.full_name || 'المستخدم'}</div>
            <div className="text-[10px] text-slate-500 font-bold font-arabic">{roleLabels[profile?.role || 'coach']}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm border border-emerald-200 overflow-hidden">
             {profile?.full_name ? profile.full_name.charAt(0) : <User size={20} />}
          </div>
        </div>

      </div>
    </div>
  );
}
