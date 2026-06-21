import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: 'green' | 'gold' | 'red' | 'blue' | 'purple';
  subtitle?: string;
}

const colorMap = {
  green: {
    border: 'border-r-emerald-600',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  gold: {
    border: 'border-r-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  red: {
    border: 'border-r-red-500',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
  },
  blue: {
    border: 'border-r-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  purple: {
    border: 'border-r-violet-500',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
};

export default function KPICard({ title, value, icon, color, subtitle }: KPICardProps) {
  const c = colorMap[color];

  return (
    <div className={`glass-panel rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 border-r-4 ${c.border}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${c.iconBg} ${c.iconColor} text-xl`}>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-slate-800 tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 font-medium mt-0.5">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
