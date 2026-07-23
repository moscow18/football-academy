import Modal from '../ui/Modal';
import { formatMoney, formatMonth } from '../../lib/utils';
import { Users, TrendingUp, TrendingDown, Award, Calendar } from 'lucide-react';

export type KPIType = 'players' | 'monthly_sub' | 'league_sub' | 'expenses_salaries' | 'kits';

interface KPIAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: KPIType | null;
  month: string;
  branchName: string;
  data: {
    activePlayersCount: number;
    monthlyRevenue: number;
    leagueRevenue: number;
    kitsRevenue?: number;
    totalExpenses: number;
    totalSalaries: number;
    recentPlayers: any[];
  };
}

export default function KPIAnalyticsModal({
  isOpen,
  onClose,
  kpiType,
  month,
  branchName,
  data,
}: KPIAnalyticsModalProps) {
  if (!isOpen || !kpiType) return null;

  const totalExpensesAndSalaries = data.totalExpenses + data.totalSalaries;
  const kitsRev = data.kitsRevenue || 0;

  const getTitle = () => {
    switch (kpiType) {
      case 'players': return '👥 تفاصيل إحصائيات اللاعبين النشطين';
      case 'monthly_sub': return '🟢 تحليلات إيرادات الاشتراكات الشهرية';
      case 'league_sub': return '🏆 تحليلات إيرادات اشتراكات الدوري';
      case 'expenses_salaries': return '🔻 تفكيك الالتزامات والمصروفات والرواتب';
      case 'kits': return '👕 تحليلات ومبيعات أطقم وملابس الأكاديمية';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size="lg"
      footer={
        <div className="flex justify-between items-center w-full font-[Cairo]">
          <span className="text-xs text-slate-500 font-bold">
            الشهر المالي: <strong className="text-emerald-700 font-tabular">{formatMonth(month)}</strong> — {branchName}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      }
    >
      <div className="space-y-5 font-[Cairo]">

        {/* 1. Active Players KPI */}
        {kpiType === 'players' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-700 font-bold mb-1">إجمالي اللاعبين المسجلين النشطين</div>
                <div className="text-3xl font-extrabold text-emerald-900 font-tabular">{data.activePlayersCount} <span className="text-sm font-bold">لاعب</span></div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                <Users size={24} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Calendar size={16} className="text-emerald-600" />
                <span>أحدث اللاعبين المنضمين حديثاً ({data.recentPlayers.length})</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {data.recentPlayers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">لا يوجد لاعبين مضافين حديثاً</p>
                ) : (
                  data.recentPlayers.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                          {p.full_name.charAt(0)}
                        </div>
                        <span>{p.full_name}</span>
                      </div>
                      <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {p.branches?.name || branchName}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Monthly Subscriptions KPI */}
        {kpiType === 'monthly_sub' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-700 font-bold mb-1">إجمالي تحصيل الاشتراكات الشهرية الفعلي</div>
                <div className="text-3xl font-extrabold text-emerald-900 font-tabular">{formatMoney(data.monthlyRevenue)} <span className="text-sm font-bold">ج.م</span></div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
              <h4 className="font-bold text-slate-900 text-sm">💡 كيفية احتساب الإيراد الشهري:</h4>
              <p>• يُحسب هذا المبلغ حصريةً وبدقة من عمليات الدفع الفعلية المسددة لشهر <strong>{formatMonth(month)}</strong>.</p>
              <p>• لا يعتمد على التوقعات أو التقديرات العشوائية لتأمين بيانات مالية حقيقية 100%.</p>
            </div>
          </div>
        )}

        {/* 3. League Subscriptions KPI */}
        {kpiType === 'league_sub' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-700 font-bold mb-1">إجمالي تحصيل اشتراكات الدوري الفعلي</div>
                <div className="text-3xl font-extrabold text-blue-900 font-tabular">{formatMoney(data.leagueRevenue)} <span className="text-sm font-bold">ج.م</span></div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                <Award size={24} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
              <h4 className="font-bold text-slate-900 text-sm">💡 كيفية احتساب اشتراكات الدوري:</h4>
              <p>• يُمثل هذا المبلغ الإيراد المحصل المباشر من رسوم اشتراكات البطولات والمجموعات الدورية المسجلة للاعبي الدوري خلال الشهر.</p>
            </div>
          </div>
        )}

        {/* 4. Kits & Apparel KPI */}
        {kpiType === 'kits' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-purple-700 font-bold mb-1">إجمالي مبيعات وإيرادات الأطقم واللبس</div>
                <div className="text-3xl font-extrabold text-purple-900 font-tabular">{formatMoney(kitsRev)} <span className="text-sm font-bold">ج.م</span></div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                👕
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
              <h4 className="font-bold text-slate-900 text-sm">💡 تحليلات الأطقم والملابس الرياضية:</h4>
              <p>• يُسجل هذا المبلغ من إجمالي مبيعات الملابس والأطقم المسلمة والمبيعات الفورية للأكاديمية خلال شهر <strong>{formatMonth(month)}</strong>.</p>
              <p>• تُضاف مبيعات الأطقم تلقائياً إلى مجموع إيرادات الأكاديمية لتدخل في حساب صافي الربح النهائي.</p>
            </div>
          </div>
        )}

        {/* 5. Expenses & Salaries KPI */}
        {kpiType === 'expenses_salaries' && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-rose-700 font-bold mb-1">إجمالي المصروفات والرواتب الخارجي</div>
                <div className="text-3xl font-extrabold text-rose-900 font-tabular">{formatMoney(totalExpensesAndSalaries)} <span className="text-sm font-bold">ج.م</span></div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                <TrendingDown size={24} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs">
                <div className="text-xs text-slate-500 font-bold mb-1">1. المصروفات التشغيلية العامة</div>
                <div className="text-xl font-extrabold text-rose-700 font-tabular">{formatMoney(data.totalExpenses)} ج.م</div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">إيجارات، كهرباء، صيانة، أدوات تدريب</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs">
                <div className="text-xs text-slate-500 font-bold mb-1">2. رواتب وسلف المدربين</div>
                <div className="text-xl font-extrabold text-amber-700 font-tabular">{formatMoney(data.totalSalaries)} ج.م</div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">المرتبات الأساسية والدفعات المسددة</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
