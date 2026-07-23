import Modal from '../ui/Modal';
import { formatMoney, formatMonth } from '../../lib/utils';
import type { NetProfit } from '../../lib/types';
import { TrendingUp, TrendingDown, PieChart, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfitExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  profitData: NetProfit[];
  branchName?: string;
}

export default function ProfitExplanationModal({
  isOpen,
  onClose,
  month,
  profitData,
  branchName = 'جميع الفروع',
}: ProfitExplanationModalProps) {
  if (!isOpen) return null;

  // Aggregate totals across branches if multiple
  const totalFeeRevenue = profitData.reduce((s, r) => s + Number(r.fee_revenue || 0), 0);
  const totalKitRevenue = profitData.reduce((s, r) => s + Number(r.kit_revenue || 0), 0);
  const totalIncome = totalFeeRevenue + totalKitRevenue;

  const totalExpenses = profitData.reduce((s, r) => s + Number(r.total_expenses || 0), 0);
  const totalSalaries = profitData.reduce((s, r) => s + Number(r.salaries_paid || 0), 0);
  const totalKitCost = profitData.reduce((s, r) => s + Number(r.kit_cost || 0), 0);
  const totalOutflow = totalExpenses + totalSalaries + totalKitCost;

  const netProfit = totalIncome - totalOutflow;

  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';
  const feePct = totalIncome > 0 ? ((totalFeeRevenue / totalIncome) * 100).toFixed(1) : '0';
  const kitPct = totalIncome > 0 ? ((totalKitRevenue / totalIncome) * 100).toFixed(1) : '0';

  const expensesPct = totalOutflow > 0 ? ((totalExpenses / totalOutflow) * 100).toFixed(1) : '0';
  const salariesPct = totalOutflow > 0 ? ((totalSalaries / totalOutflow) * 100).toFixed(1) : '0';
  const kitCostPct = totalOutflow > 0 ? ((totalKitCost / totalOutflow) * 100).toFixed(1) : '0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📊 التحليل المالي والتفسيري لصافي الربح"
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full font-[Cairo]">
          <div className="text-xs text-slate-500 font-bold">
            الشهر المالي: <span className="text-emerald-700 font-tabular font-extrabold">{formatMonth(month)}</span> — {branchName}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
          >
            إغلاق التقرير
          </button>
        </div>
      }
    >
      <div className="space-y-6 font-[Cairo]">
        
        {/* Banner: Formula Callout */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-emerald-500/30 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                <PieChart size={16} />
                <span>معادلة صافي الربح المالي (Financial Net Profit Formula)</span>
              </div>
              <h3 className="text-xl font-extrabold font-arabic">
                المعادلة: <span className="text-emerald-300">صافي الربح = إجمالي الإيرادات - إجمالي المصروفات والرواتب</span>
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                يتم حساب هذا التقرير آلياً باستخراج بيانات اشتراكات اللاعبين، المبيعات، المصروفات التشغيلية، ورواتب وسلف المدربين من قاعدة البيانات.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 text-center shrink-0 min-w-[170px]">
              <div className="text-xs text-emerald-300 font-bold mb-0.5">صافي الربح النهائي</div>
              <div className={`text-2xl font-extrabold font-tabular ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(netProfit)} <span className="text-xs">ج.م</span>
              </div>
              <div className="text-[10px] text-slate-300 mt-1 font-bold">
                هامش الربح: {profitMargin}%
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-Step Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Card 1: Incomes Breakdown */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-emerald-200/60 pb-3">
              <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-base">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <span>📥 1. إجمالي الإيرادات التدفقية</span>
              </div>
              <span className="text-lg font-extrabold text-emerald-700 font-tabular">{formatMoney(totalIncome)} ج.م</span>
            </div>

            <div className="space-y-3 text-sm">
              {/* Fee Revenue */}
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 text-xs">اشتراكات اللاعبين (شهري + دوري)</span>
                  <span className="font-extrabold text-slate-900 font-tabular">{formatMoney(totalFeeRevenue)} ج.م</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${feePct}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">{feePct}% من إجمالي الإيرادات</div>
              </div>

              {/* Kit Revenue */}
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 text-xs">مبيعات أطقم ومستلزمات المتجر</span>
                  <span className="font-extrabold text-slate-900 font-tabular">{formatMoney(totalKitRevenue)} ج.م</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${kitPct}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">{kitPct}% من إجمالي الإيرادات</div>
              </div>
            </div>
          </div>

          {/* Card 2: Outflow / Expenses Breakdown */}
          <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-rose-200/60 pb-3">
              <div className="flex items-center gap-2 text-rose-800 font-extrabold text-base">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                  <TrendingDown size={18} />
                </div>
                <span>📤 2. إجمالي المصروفات والالتزامات</span>
              </div>
              <span className="text-lg font-extrabold text-rose-700 font-tabular">{formatMoney(totalOutflow)} ج.م</span>
            </div>

            <div className="space-y-3 text-sm">
              {/* Operational Expenses */}
              <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 text-xs">المصروفات التشغيلية العامة (إيجار، كهرباء، أدوات...)</span>
                  <span className="font-extrabold text-rose-700 font-tabular">{formatMoney(totalExpenses)} ج.م</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${expensesPct}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">{expensesPct}% من إجمالي التكاليف</div>
              </div>

              {/* Salaries Paid */}
              <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 text-xs">رواتب وسلف المدربين والموظفين</span>
                  <span className="font-extrabold text-rose-700 font-tabular">{formatMoney(totalSalaries)} ج.م</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${salariesPct}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">{salariesPct}% من إجمالي التكاليف</div>
              </div>

              {/* Kit Cost */}
              {totalKitCost > 0 && (
                <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 text-xs">تكلفة شراء بضائع الأطقم والمخزون</span>
                    <span className="font-extrabold text-rose-700 font-tabular">{formatMoney(totalKitCost)} ج.م</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-slate-600 h-full rounded-full transition-all" style={{ width: `${kitCostPct}%` }}></div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">{kitCostPct}% من إجمالي التكاليف</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Explanation Text for Presentation / Graduation Project */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <HelpCircle size={18} className="text-blue-600" />
            <span>لماذا طلع صافي الربح بهذا الرقم؟ (الشرح التفصيلي للمناقشة والإدارة)</span>
          </h4>
          
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed font-arabic">
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold shrink-0">1️⃣</span>
              <span><strong>التدفق الإيرادي:</strong> بلغت الإيرادات الإجمالية المحصلة <strong className="text-emerald-700 font-tabular font-bold">{formatMoney(totalIncome)} ج.م</strong>، حيث تُمثل اشتراكات اللاعبين (الشهري والدوري) النسبة الكبرى بواقع ({feePct}%) ومبيعات الأطقم نسبة ({kitPct}%).</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-rose-600 font-bold shrink-0">2️⃣</span>
              <span><strong>إجمالي الخصومات والتكاليف:</strong> تم خصم مصروفات تشغيلية بقيمة <strong className="text-rose-600 font-tabular font-bold">{formatMoney(totalExpenses)} ج.م</strong> بالإضافة إلى رواتب وسلف مدربين وموظفين بقيمة <strong className="text-rose-600 font-tabular font-bold">{formatMoney(totalSalaries)} ج.م</strong> ليصبح مجموع التكاليف الخارجي <strong className="text-rose-700 font-tabular font-bold">{formatMoney(totalOutflow)} ج.م</strong>.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-blue-600 font-bold shrink-0">3️⃣</span>
              <span><strong>النتيجة النهائية:</strong> بطرح التكاليف من الإيرادات يكون صافي الربح <strong className={`font-tabular font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(netProfit)} ج.م</strong> بنسبة هامش ربحية تقدر بـ <strong className="font-tabular font-bold">{profitMargin}%</strong>.</span>
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2">
            {netProfit > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-200">
                <CheckCircle2 size={15} /> الأداء المالي ممتاز وفي مرحلة ربحية إيجابية
              </span>
            ) : netProfit === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-extrabold border border-amber-200">
                <AlertCircle size={15} /> الأداء المالي متوازن عند نقطة التعادل (Break-even)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-extrabold border border-red-200">
                <AlertCircle size={15} /> توجد زيادة في المصروفات أو الرواتب تتجاوز الإيرادات الحالية
              </span>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
}
