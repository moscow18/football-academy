export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }[size];

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sizeClass} border-slate-200 border-t-emerald-600 rounded-full animate-spin`} />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-slate-500 font-medium text-sm">جاري التحميل...</p>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 surface-card bg-slate-50/50">
      <div className="text-slate-300 mb-4">{icon}</div>
      <p className="text-base font-semibold text-slate-700 font-arabic">{title}</p>
      {subtitle && <p className="text-sm mt-2 text-slate-500 font-arabic">{subtitle}</p>}
    </div>
  );
}
