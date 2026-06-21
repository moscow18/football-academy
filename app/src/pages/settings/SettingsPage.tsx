import { useState, useEffect } from 'react';
import { Building2, MapPin, Shield, CreditCard, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('branches').select('*').order('created_at').then(({ data }) => {
      if (data) setBranches(data);
    });
  }, []);

  const [generalData, setGeneralData] = useState({
    academyName: 'أكاديمية VFC',
    email: 'contact@vfc.com',
    phone: '+20 123 456 7890',
    address: 'القاهرة، مصر',
    currency: 'ج.م',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save
    alert('تم حفظ الإعدادات بنجاح');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-800">إعدادات النظام</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-5 py-4 text-right transition-colors ${
                activeTab === 'general' ? 'bg-emerald-50 text-emerald-700 border-r-4 border-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
              }`}
            >
              <Building2 size={20} />
              بيانات الأكاديمية
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`w-full flex items-center gap-3 px-5 py-4 text-right transition-colors ${
                activeTab === 'branches' ? 'bg-emerald-50 text-emerald-700 border-r-4 border-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
              }`}
            >
              <MapPin size={20} />
              إدارة الفروع
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-5 py-4 text-right transition-colors ${
                activeTab === 'security' ? 'bg-emerald-50 text-emerald-700 border-r-4 border-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
              }`}
            >
              <Shield size={20} />
              الأمان والصلاحيات
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-5 py-4 text-right transition-colors border-t border-slate-100 ${
                activeTab === 'billing' ? 'bg-emerald-50 text-emerald-700 border-r-4 border-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
              }`}
            >
              <CreditCard size={20} />
              الاشتراك والفوترة
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          
          {activeTab === 'general' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">البيانات الأساسية للأكاديمية</h2>
              
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">اسم الأكاديمية</label>
                    <input
                      type="text"
                      value={generalData.academyName}
                      onChange={(e) => setGeneralData({...generalData, academyName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني الرسمي</label>
                    <input
                      type="email"
                      value={generalData.email}
                      onChange={(e) => setGeneralData({...generalData, email: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={generalData.phone}
                      onChange={(e) => setGeneralData({...generalData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">العملة الافتراضية</label>
                    <select
                      value={generalData.currency}
                      onChange={(e) => setGeneralData({...generalData, currency: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
                    >
                      <option value="ج.م">الجنيه المصري (ج.م)</option>
                      <option value="SAR">الريال السعودي (SAR)</option>
                      <option value="USD">الدولار الأمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700">العنوان الرئيسي</label>
                    <input
                      type="text"
                      value={generalData.address}
                      onChange={(e) => setGeneralData({...generalData, address: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button type="submit" className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                    <Save size={20} />
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">إدارة الفروع</h2>
                <button 
                  onClick={async () => {
                    const name = prompt('أدخل اسم الفرع الجديد:');
                    if (name) {
                      const { error } = await supabase.from('branches').insert({ name });
                      if (error) alert('خطأ في إضافة الفرع');
                      else {
                        alert('تم إنشاء الفرع بنجاح');
                        supabase.from('branches').select('*').order('created_at').then(({ data }) => setBranches(data || []));
                      }
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  + إضافة فرع جديد
                </button>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-slate-500 font-bold text-sm">اسم الفرع</th>
                      <th className="px-6 py-3 text-slate-500 font-bold text-sm">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-slate-500 font-bold text-sm text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branches.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-500">لا يوجد فروع مسجلة. قم بإضافة فرع جديد.</td></tr>
                    ) : (
                      branches.map(b => (
                        <tr key={b.id} className="hover:bg-white transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{b.name}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{b.created_at?.split('T')[0]}</td>
                          <td className="px-6 py-4 text-center">
                            <button className="text-blue-600 font-bold text-sm hover:underline">تعديل</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="animate-fade-in text-center py-12">
              <Shield size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">إعدادات الأمان</h3>
              <p className="text-slate-500">هنا يمكنك تفعيل التحقق بخطوتين وإدارة الجلسات.</p>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="animate-fade-in text-center py-12">
              <CreditCard size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">الاشتراك والفوترة</h3>
              <p className="text-slate-500">متابعة اشتراك الأكاديمية وبطاقات الدفع الخاصة بك.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
