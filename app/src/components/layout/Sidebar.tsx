import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, Users, ClipboardCheck, Wallet, AlertCircle, 
  FileText, GraduationCap, ShoppingBag, TrendingDown, 
  PieChart, Settings, LogOut
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
  { path: '/debts', label: 'الاشتراكات والمديونيات', icon: AlertCircle, roles: ['owner'] },
  { path: '/invoices', label: 'الفواتير', icon: FileText, roles: ['owner'] },
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
  const location = useLocation();
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
        <div className="p-8 pb-6 flex flex-col items-center border-b border-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-700 text-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl leading-none -mt-1 font-bold">⚽</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-emerald-800 text-2xl font-extrabold tracking-tight font-arabic leading-none mb-1">أكاديمية VFC</h2>
              <span className="text-slate-500 text-[10px] font-bold font-arabic leading-none">نظام الإدارة الرياضية</span>
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
                  to={item.path + location.search}
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
