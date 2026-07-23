/**
 * Utility functions for the VFC Academy system.
 * All formatters handle Arabic locale and RTL display.
 */

/** Format a number as Arabic-locale currency (EGP) */
export function formatMoney(amount: number | null | undefined): string {
  const n = Number(amount || 0);
  return n.toLocaleString('en-US');
}

/** Format a date string to Arabic-readable format */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Format date to ISO string (YYYY-MM-DD) */
export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** Get current month in YYYY-MM format */
export function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Calculate the financial month (YYYY-MM) for a specific date and branch closing day */
export function getFinancialMonthForDate(dateStr: string | null | undefined, closingDay: number = 30): string {
  if (!dateStr) return getCurrentMonth();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return getCurrentMonth();

  let year = d.getFullYear();
  let month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  if (closingDay > 0 && closingDay < 31 && day > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Calculate the active financial month of a branch based on its closing day */
export function getActiveFinancialMonth(branch: { closing_day?: number } | null): string {
  const closingDay = branch?.closing_day || 30;
  return getFinancialMonthForDate(new Date().toISOString(), closingDay);
}

/** Format month string (YYYY-MM) to Arabic display */
export function formatMonth(month: string): string {
  if (!month) return '—';
  const [year, m] = month.split('-');
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  return `${monthNames[parseInt(m) - 1]} ${year}`;
}

/** Calculate age from date of birth */
export function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Build a WhatsApp link with prefilled message */
export function buildWhatsAppLink(phone: string, message: string): string {
  // Remove leading 0, add Egypt country code
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '2' + cleaned;
  }
  if (!cleaned.startsWith('20')) {
    cleaned = '20' + cleaned;
  }
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/** Generate a WhatsApp late arrival message */
export function lateArrivalMessage(playerName: string): string {
  return `السلام عليكم 🙏\nنود إبلاغكم أن اللاعب ${playerName} وصل متأخراً لتدريب اليوم.\nنرجو الالتزام بالمواعيد المحددة.\nأكاديمية VFC ⚽`;
}

/** Generate a WhatsApp debt reminder message */
export function debtReminderMessage(playerName: string, amount: number, nextDate?: string | null): string {
  let msg = `السلام عليكم 🙏\nنذكركم بأن هناك مبلغ مستحق قدره ${formatMoney(amount)} جنيه على اللاعب ${playerName}.\n`;
  if (nextDate) {
    msg += `علماً بأن موعد التجديد هو: ${formatDate(nextDate)}.\n`;
  }
  msg += `نرجو سداد المبلغ في أقرب وقت.\nشكراً لتعاونكم.\nأكاديمية VFC ⚽`;
  return msg;
}

/** Generate a WhatsApp renewal reminder message */
export function renewalReminderMessage(playerName: string, nextDate: string, lastDate: string | null): string {
  let msg = `السلام عليكم 🙏\nنذكركم باقتراب موعد تجديد الاشتراك للاعب ${playerName}.\n`;
  msg += `📅 موعد التجديد المستحق: ${formatDate(nextDate)}\n`;
  if (lastDate) {
    msg += `💳 تاريخ آخر دفعة مسجلة: ${formatDate(lastDate)}\n`;
  }
  msg += `شكراً لتعاونكم.\nأكاديمية VFC ⚽`;
  return msg;
}

/** Generate absence warning message */
export function absenceWarningMessage(playerName: string, count: number): string {
  return `السلام عليكم 🙏\nنود إبلاغكم أن اللاعب ${playerName} تغيب ${count} حصص متتالية.\nنرجو التواصل معنا لمعرفة السبب.\nأكاديمية VFC ⚽`;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen) + '...';
}

/** Get branch accent color class number (1-3) from branch ID */
export function getBranchColorIndex(branchId: string): number {
  if (branchId === 'b0000001-0000-0000-0000-000000000001') return 1;
  if (branchId === 'b0000002-0000-0000-0000-000000000002') return 2;
  if (branchId === 'b0000003-0000-0000-0000-000000000003') return 3;
  // For dynamic branches, hash the ID
  let hash = 0;
  for (let i = 0; i < branchId.length; i++) {
    hash = ((hash << 5) - hash) + branchId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 3) + 1;
}

/** Debounce helper */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
