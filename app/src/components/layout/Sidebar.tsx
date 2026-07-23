import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, Users, ClipboardCheck, Wallet, AlertCircle, 
  FileText, GraduationCap, ShoppingBag, TrendingDown, 
  PieChart, Settings, LogOut, Trophy
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC<any>;
  roles: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['owner', 'admin', 'coach'] },
  { path: '/players', label: 'اللاعبين', icon: Users, roles: ['owner', 'admin', 'coach'] },
  { path: '/attendance', label: 'الحضور', icon: ClipboardCheck, roles: ['owner', 'admin', 'coach'] },
  { path: '/payments', label: 'المدفوعات', icon: Wallet, roles: ['owner', 'admin'] },
  { path: '/debts', label: 'الاشتراكات والمحصل المالي', icon: AlertCircle, roles: ['owner', 'admin'] },
  { path: '/periodic-subscriptions', label: 'الاشتراكات الدورية (الدوري)', icon: Trophy, roles: ['owner', 'admin'] },
  { path: '/invoices', label: 'الفواتير', icon: FileText, roles: ['owner', 'admin'] },
  { path: '/coaches', label: 'المدربين', icon: GraduationCap, roles: ['owner', 'admin'] },
  { path: '/groups', label: 'الفرق التدريبية', icon: Users, roles: ['owner', 'admin'] },
  { path: '/kits', label: 'الأطقم والمتجر', icon: ShoppingBag, roles: ['owner', 'admin'] },
  { path: '/expenses', label: 'المصروفات', icon: TrendingDown, roles: ['owner'] },
  { path: '/reports', label: 'التقارير', icon: PieChart, roles: ['owner'] },
  { path: '/users', label: 'إدارة المستخدمين', icon: Settings, roles: ['owner'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const role = profile?.role || 'coach';

  const filteredItems = navItems.filter(item => item.roles.includes(role));



  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[99] md:hidden"
          onClick={onClose}
        />
      )}

      <aside 
        className={`bg-white border-l border-slate-200 w-[260px] flex-shrink-0 flex flex-col transition-all duration-300 z-[100] 
          ${isOpen ? 'fixed inset-y-0 right-0 shadow-2xl' : 'hidden md:flex'}`
        }
      >
        {/* Header Logo */}
        <div className="p-6 pb-4 flex flex-col items-center border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-slate-900 rounded-xl overflow-hidden border-2 border-amber-400 p-0.5 flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="VFC Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-emerald-900 text-xl font-black tracking-tight font-arabic leading-none mb-1">أكاديمية VFC</h2>
              <span className="text-slate-500 text-[10px] font-bold font-arabic leading-none">نظام الإدارة الرياضية والشؤون الماليّة</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {filteredItems.map((item, idx) => {
            const showDivider = idx > 0 && item.path === '/payments';
            const showDivider2 = idx > 0 && item.path === '/reports';

            return (
              <div key={item.path}>
                {(showDivider || showDivider2) && (
                  <div className="h-px bg-slate-800/50 mx-6 my-3" />
                )}
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `sidebar-nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon size={18} className="transition-transform duration-200" />
                  <span className="flex-1 font-arabic">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full font-bold shadow-sm font-tabular">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Footer - Logout Button */}
        <div className="p-4 mt-auto border-t border-slate-100">
          <button
            onClick={signOut}
            className="w-full py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 hover:text-red-600 transition-colors cursor-pointer flex items-center justify-center gap-2 font-arabic"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
