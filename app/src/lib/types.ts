// ===== ENUMS =====
export type UserRole = 'owner' | 'admin' | 'coach';
export type PlayerStatus = 'active' | 'inactive' | 'suspended';
export type PaymentMethod = 'cash' | 'transfer';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type ExpenseCategory = 'salaries' | 'equipment' | 'rent' | 'utilities' | 'kits_stock' | 'other';
export type KitCategory = 'kit' | 'training_wear' | 'accessories' | 'other';
export type KitPaymentStatus = 'paid' | 'partial' | 'unpaid';
export type WhatsAppMessageType = 'late_arrival' | 'debt_reminder' | 'absence_warning' | 'general';

// ===== DATABASE MODELS =====
export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  accent_color: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  phone: string | null;
  role: UserRole;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  branch_name?: string;
}

export interface Group {
  id: string;
  branch_id: string;
  name: string;
  coach_id: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  created_at: string;
  // Joined
  coach_name?: string;
  branch_name?: string;
  player_count?: number;
}

export interface Player {
  id: string;
  branch_id: string;
  player_code: string;
  full_name: string;
  phone: string | null;
  parent_phone: string | null;
  date_of_birth: string | null;
  group_id: string | null;
  registration_date: string;
  status: PlayerStatus;
  payment_type?: string;
  fee_amount: number;
  fee_amount_periodic?: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  group_name?: string;
  branch_name?: string;
}

export interface Attendance {
  id: string;
  player_id: string;
  branch_id: string;
  session_date: string;
  status: AttendanceStatus;
  recorded_by: string | null;
  whatsapp_sent: boolean;
  created_at: string;
  // Joined
  player_name?: string;
  player_code?: string;
}

export interface Payment {
  id: string;
  player_id: string;
  branch_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  period_covered: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  // Joined
  player_name?: string;
  player_code?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  player_id: string;
  payment_id: string | null;
  branch_id: string;
  amount: number;
  issued_date: string;
  pdf_url: string | null;
  created_at: string;
  // Joined
  player_name?: string;
  player_code?: string;
}

export interface Coach {
  user_id: string;
  base_salary: number;
  specialization: string | null;
  hire_date: string;
  // Joined from users
  full_name?: string;
  phone?: string;
  branch_id?: string;
  branch_name?: string;
  is_active?: boolean;
}

export interface CoachAdvance {
  id: string;
  coach_id: string;
  branch_id: string;
  amount: number;
  advance_date: string;
  notes: string | null;
  created_at: string;
  // Joined
  coach_name?: string;
}

export interface CoachSalaryPayment {
  id: string;
  coach_id: string;
  branch_id: string;
  amount: number;
  payment_month: string;
  payment_date: string;
  created_at: string;
}

export interface Expense {
  id: string;
  branch_id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  // Joined
  branch_name?: string;
}

export interface KitItem {
  id: string;
  branch_id: string;
  item_name: string;
  category: KitCategory;
  size_options: string[];
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  // Joined
  branch_name?: string;
}

export interface KitPurchase {
  id: string;
  player_id: string;
  kit_item_id: string;
  branch_id: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  amount_paid: number;
  payment_status: KitPaymentStatus;
  purchase_date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  // Joined
  player_name?: string;
  player_code?: string;
  item_name?: string;
}

export interface WhatsAppLog {
  id: string;
  player_id: string;
  branch_id: string;
  message_type: WhatsAppMessageType;
  message_text: string | null;
  sent_at: string;
  sent_by: string | null;
}

// ===== RPC RETURN TYPES =====
export interface MonthlyRevenue {
  branch_id: string;
  branch_name: string;
  fee_revenue: number;
  kit_revenue: number;
  total_revenue: number;
}

export interface AttendanceSummary {
  group_id: string;
  group_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_pct: number;
}

export interface NetProfit {
  branch_id: string;
  branch_name: string;
  fee_revenue: number;
  kit_revenue: number;
  kit_cost: number;
  total_expenses: number;
  salaries_paid: number;
  net_profit: number;
}

export interface AbsenceAlert {
  player_id: string;
  player_name: string;
  player_code: string;
  branch_id: string;
  branch_name: string;
  group_name: string;
  consecutive_absences: number;
  last_absent_date: string;
}

export interface DebtItem {
  player_id: string;
  player_name: string;
  player_code: string;
  branch_id: string;
  branch_name: string;
  group_name: string;
  phone: string | null;
  parent_phone: string | null;
  date_of_birth: string | null;
  fee_amount: number;
  fee_amount_periodic: number;
  payment_type: string;
  registration_date: string;
  months_enrolled: number;
  total_expected: number;
  total_paid: number;
  debt: number;
  last_payment_date: string | null;
  next_payment_date: string | null;
}

export interface RevenueTrend {
  month: string;
  branch_id: string;
  branch_name: string;
  revenue: number;
}

export interface LedgerTransaction {
  transaction_id: string;
  transaction_date: string;
  transaction_type: 'income' | 'outcome';
  category: string;
  amount: number;
  notes: string | null;
  branch_name: string;
  person_name: string | null;
}

// ===== UI TYPES =====
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterState {
  search: string;
  group_id?: string;
  status?: string;
  payment_type?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  salaries: 'رواتب',
  equipment: 'معدات',
  rent: 'إيجار',
  utilities: 'مرافق',
  kits_stock: 'مخزون أطقم',
  other: 'أخرى',
};

export const KIT_CATEGORY_LABELS: Record<KitCategory, string> = {
  kit: 'طقم',
  training_wear: 'ملابس تدريب',
  accessories: 'إكسسوارات',
  other: 'أخرى',
};

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  suspended: 'موقوف',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  transfer: 'تحويل',
};
