import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const pageTitles: Record<string, string> = {
  '/': 'لوحة التحكم',
  '/players': 'إدارة اللاعبين',
  '/attendance': 'تسجيل الحضور',
  '/payments': 'المدفوعات',
  '/debts': 'المديونيات',
  '/invoices': 'الفواتير',
  '/coaches': 'المدربين',
  '/kits': 'الأطقم والمتجر',
  '/expenses': 'المصروفات',
  '/reports': 'التقارير',
  '/users': 'إدارة المستخدمين',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  
  // Get page title from path (handle nested routes)
  const basePath = '/' + (location.pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'لوحة التحكم';

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden relative font-arabic" dir="rtl">
      {/* Fixed Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top Header */}
        <div className="flex-shrink-0">
          <TopBar title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        </div>
        
        {/* Scrollable Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in custom-scrollbar">
          <div className="max-w-[1600px] mx-auto relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
