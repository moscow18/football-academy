-- ================================================================
-- GREEN HILL FOOTBALL ACADEMY — SUPABASE MIGRATION
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- ================================================================
-- 1. CUSTOM ENUM TYPES
-- ================================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'coach');
CREATE TYPE player_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE payment_method AS ENUM ('cash', 'transfer');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE expense_category AS ENUM ('salaries', 'equipment', 'rent', 'utilities', 'kits_stock', 'other');
CREATE TYPE kit_category AS ENUM ('kit', 'training_wear', 'accessories', 'other');
CREATE TYPE kit_payment_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE whatsapp_message_type AS ENUM ('late_arrival', 'debt_reminder', 'absence_warning', 'general');

-- ================================================================
-- 2. TABLES
-- ================================================================

-- BRANCHES
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  accent_color text DEFAULT '#059669',
  created_at timestamptz DEFAULT now()
);

-- USER PROFILES (extends auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role user_role NOT NULL DEFAULT 'coach',
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- GROUPS
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  coach_id uuid REFERENCES users(id) ON DELETE SET NULL,
  schedule_days text[] DEFAULT '{}',
  schedule_time time,
  created_at timestamptz DEFAULT now()
);

-- PLAYERS
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  player_code text UNIQUE,
  full_name text NOT NULL,
  phone text,
  parent_phone text,
  date_of_birth date,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  registration_date date DEFAULT CURRENT_DATE,
  status player_status DEFAULT 'active',
  payment_type text DEFAULT 'monthly',
  fee_amount numeric DEFAULT 0,
  fee_amount_periodic numeric DEFAULT 0,
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_players_branch_status ON players(branch_id, status);
CREATE INDEX idx_players_branch_group ON players(branch_id, group_id);
CREATE INDEX idx_players_code ON players(player_code);

-- ATTENDANCE
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  recorded_by uuid REFERENCES users(id),
  whatsapp_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, session_date)
);

CREATE INDEX idx_attendance_branch_date ON attendance(branch_id, session_date);

-- PAYMENTS
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date DEFAULT CURRENT_DATE,
  method payment_method DEFAULT 'cash',
  period_covered text,
  notes text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_branch_date ON payments(branch_id, payment_date);
CREATE INDEX idx_payments_player ON payments(player_id);

-- INVOICES
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  issued_date date DEFAULT CURRENT_DATE,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- COACHES (financial details for users with role='coach')
CREATE TABLE coaches (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_salary numeric DEFAULT 0,
  specialization text,
  hire_date date DEFAULT CURRENT_DATE
);

-- COACH ADVANCES
CREATE TABLE coach_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  advance_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- COACH SALARY PAYMENTS
CREATE TABLE coach_salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_month text,
  payment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- EXPENSES
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category expense_category NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  expense_date date DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- KIT ITEMS
CREATE TABLE kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category kit_category DEFAULT 'kit',
  size_options text[] DEFAULT '{}',
  cost_price numeric DEFAULT 0,
  sale_price numeric DEFAULT 0,
  stock_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- KIT PURCHASES
CREATE TABLE kit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kit_item_id uuid NOT NULL REFERENCES kit_items(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  size text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  payment_status kit_payment_status DEFAULT 'unpaid',
  purchase_date date DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_kit_purchases_branch_date ON kit_purchases(branch_id, purchase_date);
CREATE INDEX idx_kit_purchases_player ON kit_purchases(player_id);

-- WHATSAPP LOG
CREATE TABLE whatsapp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  message_type whatsapp_message_type NOT NULL DEFAULT 'general',
  message_text text,
  sent_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES users(id)
);

-- ================================================================
-- 3. HELPER FUNCTIONS
-- ================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$;

-- Get current user's branch_id (NULL for owner)
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT branch_id FROM users WHERE id = auth.uid();
$$;

-- Get group_ids assigned to current coach
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM groups WHERE coach_id = auth.uid();
$$;

-- ================================================================
-- 4. PLAYER CODE AUTO-GENERATION TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION generate_player_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  branch_initial text;
  seq_num integer;
BEGIN
  -- Get first letter of branch name, default to 'X'
  SELECT COALESCE(
    CASE 
      WHEN b.name ILIKE '%سداسي%' THEN 'S'
      WHEN b.name ILIKE '%ثلاثي%' THEN 'T'
      WHEN b.name ILIKE '%خماسي%' THEN 'K'
      ELSE UPPER(LEFT(b.name, 1))
    END, 'X'
  ) INTO branch_initial
  FROM branches b WHERE b.id = NEW.branch_id;

  -- Count existing players in this branch for sequence
  SELECT COUNT(*) + 1 INTO seq_num
  FROM players WHERE branch_id = NEW.branch_id;

  NEW.player_code := 'GH-' || branch_initial || '-' || LPAD(seq_num::text, 4, '0');
  
  -- Handle potential duplicates
  WHILE EXISTS(SELECT 1 FROM players WHERE player_code = NEW.player_code) LOOP
    seq_num := seq_num + 1;
    NEW.player_code := 'GH-' || branch_initial || '-' || LPAD(seq_num::text, 4, '0');
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_player_code
  BEFORE INSERT ON players
  FOR EACH ROW
  WHEN (NEW.player_code IS NULL)
  EXECUTE FUNCTION generate_player_code();

-- ================================================================
-- 5. INVOICE NUMBER AUTO-GENERATION TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  branch_initial text;
  seq_num integer;
BEGIN
  SELECT COALESCE(
    CASE 
      WHEN b.name ILIKE '%سداسي%' THEN 'S'
      WHEN b.name ILIKE '%ثلاثي%' THEN 'T'
      WHEN b.name ILIKE '%خماسي%' THEN 'K'
      ELSE UPPER(LEFT(b.name, 1))
    END, 'X'
  ) INTO branch_initial
  FROM branches b WHERE b.id = NEW.branch_id;

  SELECT COUNT(*) + 1 INTO seq_num
  FROM invoices WHERE branch_id = NEW.branch_id;

  NEW.invoice_number := 'GH-' || branch_initial || '-INV-' || LPAD(seq_num::text, 6, '0');
  
  WHILE EXISTS(SELECT 1 FROM invoices WHERE invoice_number = NEW.invoice_number) LOOP
    seq_num := seq_num + 1;
    NEW.invoice_number := 'GH-' || branch_initial || '-INV-' || LPAD(seq_num::text, 6, '0');
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- ================================================================
-- 6. ATOMIC KIT STOCK DECREMENT FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION sell_kit_item(
  p_kit_item_id uuid,
  p_player_id uuid,
  p_branch_id uuid,
  p_size text,
  p_quantity integer,
  p_amount_paid numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_recorded_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock integer;
  v_sale_price numeric;
  v_total numeric;
  v_status kit_payment_status;
  v_purchase_id uuid;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT stock_quantity, sale_price INTO v_stock, v_sale_price
  FROM kit_items
  WHERE id = p_kit_item_id
  FOR UPDATE;

  IF v_stock IS NULL THEN
    RAISE EXCEPTION 'Kit item not found';
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_stock, p_quantity;
  END IF;

  v_total := v_sale_price * p_quantity;
  
  IF p_amount_paid >= v_total THEN
    v_status := 'paid';
  ELSIF p_amount_paid > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'unpaid';
  END IF;

  -- Decrement stock atomically
  UPDATE kit_items
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_kit_item_id;

  -- Insert purchase record
  INSERT INTO kit_purchases (
    player_id, kit_item_id, branch_id, size, quantity,
    unit_price, total_price, amount_paid, payment_status,
    purchase_date, notes, recorded_by
  ) VALUES (
    p_player_id, p_kit_item_id, p_branch_id, p_size, p_quantity,
    v_sale_price, v_total, p_amount_paid, v_status,
    CURRENT_DATE, p_notes, p_recorded_by
  )
  RETURNING id INTO v_purchase_id;

  RETURN v_purchase_id;
END;
$$;

-- ================================================================
-- 7. REPORT RPC FUNCTIONS
-- ================================================================

-- Monthly revenue per branch (fee payments + kit sales)
CREATE OR REPLACE FUNCTION rpc_monthly_revenue(
  p_branch_id uuid DEFAULT NULL,
  p_month text DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  branch_id uuid,
  branch_name text,
  fee_revenue numeric,
  kit_revenue numeric,
  total_revenue numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id AS branch_id,
    b.name AS branch_name,
    COALESCE(SUM(p.amount) FILTER (WHERE p.id IS NOT NULL), 0) AS fee_revenue,
    COALESCE(SUM(kp.amount_paid) FILTER (WHERE kp.id IS NOT NULL), 0) AS kit_revenue,
    COALESCE(SUM(p.amount) FILTER (WHERE p.id IS NOT NULL), 0) +
    COALESCE(SUM(kp.amount_paid) FILTER (WHERE kp.id IS NOT NULL), 0) AS total_revenue
  FROM branches b
  LEFT JOIN payments p ON p.branch_id = b.id
    AND to_char(p.payment_date, 'YYYY-MM') = p_month
  LEFT JOIN kit_purchases kp ON kp.branch_id = b.id
    AND to_char(kp.purchase_date, 'YYYY-MM') = p_month
  WHERE (p_branch_id IS NULL OR b.id = p_branch_id)
  GROUP BY b.id, b.name;
$$;

-- Attendance summary per group for a date range
CREATE OR REPLACE FUNCTION rpc_attendance_summary(
  p_branch_id uuid DEFAULT NULL,
  p_from date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  group_id uuid,
  group_name text,
  total_sessions bigint,
  present_count bigint,
  absent_count bigint,
  late_count bigint,
  attendance_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    COUNT(a.id) AS total_sessions,
    COUNT(a.id) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(a.id) FILTER (WHERE a.status = 'absent') AS absent_count,
    COUNT(a.id) FILTER (WHERE a.status = 'late') AS late_count,
    CASE 
      WHEN COUNT(a.id) > 0 THEN
        ROUND(
          COUNT(a.id) FILTER (WHERE a.status IN ('present', 'late'))::numeric / COUNT(a.id) * 100,
          1
        )
      ELSE 0
    END AS attendance_pct
  FROM groups g
  LEFT JOIN players pl ON pl.group_id = g.id AND pl.status = 'active'
  LEFT JOIN attendance a ON a.player_id = pl.id
    AND a.session_date BETWEEN p_from AND p_to
  WHERE (p_branch_id IS NULL OR g.branch_id = p_branch_id)
  GROUP BY g.id, g.name;
$$;

-- Net profit calculation per branch per month
CREATE OR REPLACE FUNCTION rpc_net_profit(
  p_branch_id uuid DEFAULT NULL,
  p_month text DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  branch_id uuid,
  branch_name text,
  fee_revenue numeric,
  kit_revenue numeric,
  kit_cost numeric,
  total_expenses numeric,
  salaries_paid numeric,
  net_profit numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH rev AS (
    SELECT
      b.id AS bid,
      b.name AS bname,
      COALESCE(SUM(p.amount), 0) AS fee_rev
    FROM branches b
    LEFT JOIN payments p ON p.branch_id = b.id
      AND to_char(p.payment_date, 'YYYY-MM') = p_month
    WHERE (p_branch_id IS NULL OR b.id = p_branch_id)
    GROUP BY b.id, b.name
  ),
  kit_rev AS (
    SELECT
      kp.branch_id AS bid,
      COALESCE(SUM(kp.amount_paid), 0) AS kit_income,
      COALESCE(SUM(ki.cost_price * kp.quantity), 0) AS kit_cost_total
    FROM kit_purchases kp
    JOIN kit_items ki ON ki.id = kp.kit_item_id
    WHERE to_char(kp.purchase_date, 'YYYY-MM') = p_month
      AND (p_branch_id IS NULL OR kp.branch_id = p_branch_id)
    GROUP BY kp.branch_id
  ),
  exp AS (
    SELECT
      e.branch_id AS bid,
      COALESCE(SUM(e.amount), 0) AS total_exp
    FROM expenses e
    WHERE to_char(e.expense_date, 'YYYY-MM') = p_month
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    GROUP BY e.branch_id
  ),
  sal AS (
    SELECT
      csp.branch_id AS bid,
      COALESCE(SUM(csp.amount), 0) AS sal_paid
    FROM coach_salary_payments csp
    WHERE csp.payment_month = p_month
      AND (p_branch_id IS NULL OR csp.branch_id = p_branch_id)
    GROUP BY csp.branch_id
  )
  SELECT
    r.bid AS branch_id,
    r.bname AS branch_name,
    r.fee_rev AS fee_revenue,
    COALESCE(kr.kit_income, 0) AS kit_revenue,
    COALESCE(kr.kit_cost_total, 0) AS kit_cost,
    COALESCE(e.total_exp, 0) AS total_expenses,
    COALESCE(s.sal_paid, 0) AS salaries_paid,
    (r.fee_rev + COALESCE(kr.kit_income, 0))
      - COALESCE(e.total_exp, 0)
      - COALESCE(s.sal_paid, 0) AS net_profit
  FROM rev r
  LEFT JOIN kit_rev kr ON kr.bid = r.bid
  LEFT JOIN exp e ON e.bid = r.bid
  LEFT JOIN sal s ON s.bid = r.bid;
$$;

-- Players with 3+ consecutive absences
CREATE OR REPLACE FUNCTION rpc_absence_alerts(
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  player_id uuid,
  player_name text,
  player_code text,
  branch_id uuid,
  branch_name text,
  group_name text,
  consecutive_absences bigint,
  last_absent_date date
)
LANGUAGE sql
STABLE
AS $$
  WITH ranked AS (
    SELECT
      a.player_id,
      a.session_date,
      a.status,
      a.branch_id,
      ROW_NUMBER() OVER (PARTITION BY a.player_id ORDER BY a.session_date DESC) as rn
    FROM attendance a
    WHERE a.status = 'absent'
      AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
  ),
  streaks AS (
    SELECT
      player_id,
      branch_id,
      COUNT(*) as consecutive_absences,
      MAX(session_date) as last_absent_date
    FROM ranked
    WHERE rn <= (
      SELECT COUNT(*)
      FROM attendance a2
      WHERE a2.player_id = ranked.player_id
        AND a2.status = 'absent'
        AND a2.session_date >= (
          SELECT COALESCE(MAX(a3.session_date), '1900-01-01')
          FROM attendance a3
          WHERE a3.player_id = ranked.player_id
            AND a3.status != 'absent'
        )
    )
    GROUP BY player_id, branch_id
    HAVING COUNT(*) >= 3
  )
  SELECT
    s.player_id,
    p.full_name AS player_name,
    p.player_code,
    s.branch_id,
    b.name AS branch_name,
    g.name AS group_name,
    s.consecutive_absences,
    s.last_absent_date
  FROM streaks s
  JOIN players p ON p.id = s.player_id
  JOIN branches b ON b.id = s.branch_id
  LEFT JOIN groups g ON g.id = p.group_id
  WHERE p.status = 'active';
$$;

-- Debt list: expected fees - total paid for each active player
DROP FUNCTION IF EXISTS rpc_debt_list(uuid);

CREATE OR REPLACE FUNCTION rpc_debt_list(
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  player_id uuid,
  player_name text,
  player_code text,
  branch_id uuid,
  branch_name text,
  group_name text,
  phone text,
  parent_phone text,
  date_of_birth date,
  fee_amount numeric,
  fee_amount_periodic numeric,
  payment_type text,
  registration_date date,
  months_enrolled integer,
  total_expected numeric,
  total_paid numeric,
  debt numeric,
  last_payment_date date,
  next_payment_date date
)
LANGUAGE sql
STABLE
AS $$
  WITH player_stats AS (
    SELECT
      p.id AS player_id,
      p.full_name AS player_name,
      p.player_code,
      p.branch_id,
      b.name AS branch_name,
      g.name AS group_name,
      p.phone,
      p.parent_phone,
      p.date_of_birth,
      p.fee_amount,
      p.fee_amount_periodic,
      p.payment_type,
      p.registration_date,
      ((EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM GREATEST(p.registration_date, '2026-07-01'::date))) * 12 
       + EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM GREATEST(p.registration_date, '2026-07-01'::date)) 
       + 1)::integer AS months_enrolled,
      COALESCE(pay.total_paid, 0) AS total_paid,
      pay.last_pay_date AS last_payment_date
    FROM players p
    JOIN branches b ON b.id = p.branch_id
    LEFT JOIN groups g ON g.id = p.group_id
    LEFT JOIN (
      SELECT 
        player_id, 
        SUM(amount) AS total_paid,
        MAX(payment_date) AS last_pay_date
      FROM payments
      GROUP BY player_id
    ) pay ON pay.player_id = p.id
    WHERE p.status = 'active'
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
  )
  SELECT
    player_id,
    player_name,
    player_code,
    branch_id,
    branch_name,
    group_name,
    phone,
    parent_phone,
    date_of_birth,
    fee_amount,
    fee_amount_periodic,
    payment_type,
    registration_date,
    months_enrolled,
    -- total_expected calculation
    (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0))::numeric AS total_expected,
    total_paid,
    -- debt calculation
    GREATEST(0, (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid))::numeric AS debt,
    last_payment_date,
    -- next_payment_date calculation
    (registration_date + (months_enrolled * INTERVAL '1 month'))::date AS next_payment_date
  FROM player_stats
  ORDER BY debt DESC;
$$;

-- Revenue trend: last 6 months per branch
CREATE OR REPLACE FUNCTION rpc_revenue_trend(
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  month text,
  branch_id uuid,
  branch_name text,
  revenue numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS m
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
      date_trunc('month', CURRENT_DATE),
      '1 month'
    ) AS d
  )
  SELECT
    mo.m AS month,
    b.id AS branch_id,
    b.name AS branch_name,
    COALESCE(SUM(p.amount), 0) + COALESCE(SUM(kp.amount_paid), 0) AS revenue
  FROM months mo
  CROSS JOIN branches b
  LEFT JOIN payments p ON p.branch_id = b.id
    AND to_char(p.payment_date, 'YYYY-MM') = mo.m
  LEFT JOIN kit_purchases kp ON kp.branch_id = b.id
    AND to_char(kp.purchase_date, 'YYYY-MM') = mo.m
  WHERE (p_branch_id IS NULL OR b.id = p_branch_id)
  GROUP BY mo.m, b.id, b.name
  ORDER BY mo.m, b.name;
$$;

-- ================================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_log ENABLE ROW LEVEL SECURITY;

-- ---- BRANCHES ----
CREATE POLICY "branches_owner_all" ON branches
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "branches_admin_select" ON branches
  FOR SELECT USING (get_my_role() = 'admin' AND id = get_my_branch_id());
CREATE POLICY "branches_coach_select" ON branches
  FOR SELECT USING (get_my_role() = 'coach' AND id = get_my_branch_id());

-- ---- USERS ----
CREATE POLICY "users_owner_all" ON users
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "users_admin_select" ON users
  FOR SELECT USING (get_my_role() = 'admin' AND (branch_id = get_my_branch_id() OR id = auth.uid()));
CREATE POLICY "users_coach_select" ON users
  FOR SELECT USING (get_my_role() = 'coach' AND (branch_id = get_my_branch_id() OR id = auth.uid()));

-- ---- GROUPS ----
CREATE POLICY "groups_owner_all" ON groups
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "groups_admin_all" ON groups
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
CREATE POLICY "groups_coach_select" ON groups
  FOR SELECT USING (get_my_role() = 'coach' AND branch_id = get_my_branch_id());

-- ---- PLAYERS ----
CREATE POLICY "players_owner_all" ON players
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "players_admin_all" ON players
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
CREATE POLICY "players_coach_select" ON players
  FOR SELECT USING (
    get_my_role() = 'coach'
    AND branch_id = get_my_branch_id()
    AND group_id IN (SELECT get_my_group_ids())
  );

-- ---- ATTENDANCE ----
CREATE POLICY "attendance_owner_all" ON attendance
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "attendance_admin_all" ON attendance
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
CREATE POLICY "attendance_coach_select" ON attendance
  FOR SELECT USING (
    get_my_role() = 'coach'
    AND branch_id = get_my_branch_id()
    AND player_id IN (
      SELECT id FROM players WHERE group_id IN (SELECT get_my_group_ids())
    )
  );

-- ---- PAYMENTS ----
CREATE POLICY "payments_owner_all" ON payments
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access to payments

-- ---- INVOICES ----
CREATE POLICY "invoices_owner_all" ON invoices
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "invoices_admin_all" ON invoices
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access to invoices

-- ---- COACHES ----
CREATE POLICY "coaches_owner_all" ON coaches
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "coaches_admin_select" ON coaches
  FOR SELECT USING (
    get_my_role() = 'admin'
    AND user_id IN (SELECT id FROM users WHERE branch_id = get_my_branch_id())
  );
CREATE POLICY "coaches_coach_self" ON coaches
  FOR SELECT USING (get_my_role() = 'coach' AND user_id = auth.uid());

-- ---- COACH ADVANCES ----
CREATE POLICY "coach_advances_owner_all" ON coach_advances
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "coach_advances_admin_all" ON coach_advances
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access

-- ---- COACH SALARY PAYMENTS ----
CREATE POLICY "coach_salary_payments_owner_all" ON coach_salary_payments
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "coach_salary_payments_admin_all" ON coach_salary_payments
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access

-- ---- EXPENSES ----
CREATE POLICY "expenses_owner_all" ON expenses
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access

-- ---- KIT ITEMS ----
CREATE POLICY "kit_items_owner_all" ON kit_items
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "kit_items_admin_all" ON kit_items
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
CREATE POLICY "kit_items_coach_select" ON kit_items
  FOR SELECT USING (get_my_role() = 'coach' AND branch_id = get_my_branch_id());

-- ---- KIT PURCHASES ----
CREATE POLICY "kit_purchases_owner_all" ON kit_purchases
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "kit_purchases_admin_all" ON kit_purchases
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
-- Coach: NO access

-- ---- WHATSAPP LOG ----
CREATE POLICY "whatsapp_log_owner_all" ON whatsapp_log
  FOR ALL USING (get_my_role() = 'owner');
CREATE POLICY "whatsapp_log_admin_all" ON whatsapp_log
  FOR ALL USING (get_my_role() = 'admin' AND branch_id = get_my_branch_id());
CREATE POLICY "whatsapp_log_coach_select" ON whatsapp_log
  FOR SELECT USING (get_my_role() = 'coach' AND branch_id = get_my_branch_id());

-- ================================================================
-- 9. SEED DATA
-- ================================================================

-- Insert 3 branches
INSERT INTO branches (id, name, address, phone, accent_color) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'ملعب سداسي', 'مدينة الشروق - الحي الأول', '01000000001', '#059669'),
  ('b0000002-0000-0000-0000-000000000002', 'ملعب ثلاثي', 'مدينة الشروق - الحي الثاني', '01000000002', '#2563EB'),
  ('b0000003-0000-0000-0000-000000000003', 'ملعب خماسي', 'مدينة الشروق - الحي الثالث', '01000000003', '#D97706');

-- NOTE: Users must be created via Supabase Auth first.
-- After creating auth users, insert their profiles below.
-- The seed script below shows the structure; you'll need to replace
-- the UUIDs with actual auth.users IDs after creating accounts.

-- IMPORTANT: Run this after creating auth users via the Auth dashboard
-- or via the application's user management screen.
-- Example (replace UUIDs with actual ones from auth.users):

/*
-- Owner
INSERT INTO users (id, full_name, phone, role, branch_id, is_active) VALUES
  ('<owner-auth-uid>', 'أحمد المالك', '01012345678', 'owner', NULL, true);

-- Admin for branch 1
INSERT INTO users (id, full_name, phone, role, branch_id, is_active) VALUES
  ('<admin1-auth-uid>', 'محمد الإداري', '01023456789', 'admin', 'b0000001-0000-0000-0000-000000000001', true);

-- Coaches
INSERT INTO users (id, full_name, phone, role, branch_id, is_active) VALUES
  ('<coach1-auth-uid>', 'خالد المدرب', '01034567890', 'coach', 'b0000001-0000-0000-0000-000000000001', true),
  ('<coach2-auth-uid>', 'عمر السيد', '01045678901', 'coach', 'b0000001-0000-0000-0000-000000000001', true);
*/

-- For demo purposes, we'll create a function that can seed demo data
-- after auth users exist:

CREATE OR REPLACE FUNCTION seed_demo_data(
  p_owner_id uuid,
  p_admin1_id uuid DEFAULT NULL,
  p_admin2_id uuid DEFAULT NULL,
  p_admin3_id uuid DEFAULT NULL,
  p_coach1_id uuid DEFAULT NULL,
  p_coach2_id uuid DEFAULT NULL,
  p_coach3_id uuid DEFAULT NULL,
  p_coach4_id uuid DEFAULT NULL,
  p_coach5_id uuid DEFAULT NULL,
  p_coach6_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_b1 uuid := 'b0000001-0000-0000-0000-000000000001';
  v_b2 uuid := 'b0000002-0000-0000-0000-000000000002';
  v_b3 uuid := 'b0000003-0000-0000-0000-000000000003';
  v_g1 uuid; v_g2 uuid; v_g3 uuid; v_g4 uuid; v_g5 uuid; v_g6 uuid;
  v_p uuid;
  v_players uuid[];
  i integer;
BEGIN
  -- Owner profile
  INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
  VALUES (p_owner_id, 'أحمد المالك', '01012345678', 'owner', NULL, true)
  ON CONFLICT (id) DO NOTHING;

  -- Admins (if provided)
  IF p_admin1_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_admin1_id, 'محمد إداري السداسي', '01023456789', 'admin', v_b1, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF p_admin2_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_admin2_id, 'علي إداري الثلاثي', '01034567890', 'admin', v_b2, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF p_admin3_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_admin3_id, 'حسن إداري الخماسي', '01045678901', 'admin', v_b3, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Coaches (if provided)
  IF p_coach1_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach1_id, 'خالد المدرب', '01056789012', 'coach', v_b1, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach1_id, 5000, 'تدريب ناشئين', '2025-09-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF p_coach2_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach2_id, 'عمر السيد', '01067890123', 'coach', v_b1, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach2_id, 6000, 'تدريب شباب', '2025-09-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF p_coach3_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach3_id, 'أحمد حسني', '01078901234', 'coach', v_b2, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach3_id, 5500, 'تدريب حراس', '2025-10-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF p_coach4_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach4_id, 'ياسر عبدالله', '01089012345', 'coach', v_b2, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach4_id, 5000, 'لياقة بدنية', '2025-10-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF p_coach5_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach5_id, 'مصطفى كمال', '01090123456', 'coach', v_b3, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach5_id, 5500, 'تدريب ناشئين', '2025-11-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  IF p_coach6_id IS NOT NULL THEN
    INSERT INTO users (id, full_name, phone, role, branch_id, is_active)
    VALUES (p_coach6_id, 'سامي رضا', '01001234567', 'coach', v_b3, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO coaches (user_id, base_salary, specialization, hire_date)
    VALUES (p_coach6_id, 4500, 'تدريب مهارات', '2025-11-01')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Groups for Branch 1
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b1, 'U10', p_coach1_id, ARRAY['Sat','Mon','Wed'], '16:00')
  RETURNING id INTO v_g1;
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b1, 'U12', p_coach2_id, ARRAY['Sun','Tue','Thu'], '17:00')
  RETURNING id INTO v_g2;

  -- Groups for Branch 2
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b2, 'U10', p_coach3_id, ARRAY['Sat','Mon','Wed'], '15:00')
  RETURNING id INTO v_g3;
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b2, 'U14', p_coach4_id, ARRAY['Sun','Tue','Thu'], '16:30')
  RETURNING id INTO v_g4;

  -- Groups for Branch 3
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b3, 'U8', p_coach5_id, ARRAY['Sat','Tue','Thu'], '15:30')
  RETURNING id INTO v_g5;
  INSERT INTO groups (id, branch_id, name, coach_id, schedule_days, schedule_time)
  VALUES
    (gen_random_uuid(), v_b3, 'U16', p_coach6_id, ARRAY['Sun','Mon','Wed'], '17:30')
  RETURNING id INTO v_g6;

  -- ============ PLAYERS (15 per branch = 45 total) ============
  
  -- Branch 1 players (v_b1)
  v_players := ARRAY[]::uuid[];
  FOR i IN 1..15 LOOP
    INSERT INTO players (branch_id, full_name, phone, parent_phone, date_of_birth, group_id, registration_date, status, payment_type, fee_amount, notes)
    VALUES (
      v_b1,
      CASE i
        WHEN 1 THEN 'يوسف أحمد' WHEN 2 THEN 'عمر محمود' WHEN 3 THEN 'آدم خالد'
        WHEN 4 THEN 'زياد حسن' WHEN 5 THEN 'كريم سعيد' WHEN 6 THEN 'ياسين علي'
        WHEN 7 THEN 'محمد إبراهيم' WHEN 8 THEN 'سيف الدين' WHEN 9 THEN 'مالك طارق'
        WHEN 10 THEN 'حمزة وليد' WHEN 11 THEN 'عبدالرحمن فارس' WHEN 12 THEN 'أنس مصطفى'
        WHEN 13 THEN 'إياد عمرو' WHEN 14 THEN 'بلال سامي' WHEN 15 THEN 'تيم أشرف'
      END,
      '010' || LPAD((10000000 + i)::text, 8, '0'),
      '011' || LPAD((20000000 + i)::text, 8, '0'),
      ('2016-' || LPAD(((i % 12) + 1)::text, 2, '0') || '-15')::date,
      CASE WHEN i <= 8 THEN v_g1 ELSE v_g2 END,
      ('2026-01-' || LPAD(((i % 28) + 1)::text, 2, '0'))::date,
      'active',
      'monthly',
      CASE WHEN i <= 8 THEN 500 ELSE 600 END,
      NULL
    ) RETURNING id INTO v_p;
    v_players := v_players || v_p;
  END LOOP;

  -- Branch 2 players (v_b2)
  FOR i IN 1..15 LOOP
    INSERT INTO players (branch_id, full_name, phone, parent_phone, date_of_birth, group_id, registration_date, status, payment_type, fee_amount, notes)
    VALUES (
      v_b2,
      CASE i
        WHEN 1 THEN 'نور الدين' WHEN 2 THEN 'أسامة رشدي' WHEN 3 THEN 'طه حسين'
        WHEN 4 THEN 'مروان جمال' WHEN 5 THEN 'فهد عادل' WHEN 6 THEN 'باسم وائل'
        WHEN 7 THEN 'رامي شريف' WHEN 8 THEN 'جاسم نبيل' WHEN 9 THEN 'شادي كمال'
        WHEN 10 THEN 'وسام فتحي' WHEN 11 THEN 'ريان أسامة' WHEN 12 THEN 'غسان هاني'
        WHEN 13 THEN 'ليث عصام' WHEN 14 THEN 'حسام ماجد' WHEN 15 THEN 'أيمن رضا'
      END,
      '010' || LPAD((30000000 + i)::text, 8, '0'),
      '011' || LPAD((40000000 + i)::text, 8, '0'),
      ('2014-' || LPAD(((i % 12) + 1)::text, 2, '0') || '-10')::date,
      CASE WHEN i <= 8 THEN v_g3 ELSE v_g4 END,
      ('2026-02-' || LPAD(((i % 28) + 1)::text, 2, '0'))::date,
      'active',
      'monthly',
      CASE WHEN i <= 8 THEN 450 ELSE 550 END,
      NULL
    ) RETURNING id INTO v_p;
    v_players := v_players || v_p;
  END LOOP;

  -- Branch 3 players (v_b3)
  FOR i IN 1..15 LOOP
    INSERT INTO players (branch_id, full_name, phone, parent_phone, date_of_birth, group_id, registration_date, status, payment_type, fee_amount, notes)
    VALUES (
      v_b3,
      CASE i
        WHEN 1 THEN 'تامر هشام' WHEN 2 THEN 'عزيز منير' WHEN 3 THEN 'رؤوف سمير'
        WHEN 4 THEN 'صلاح ممدوح' WHEN 5 THEN 'هيثم بكري' WHEN 6 THEN 'أمير زكي'
        WHEN 7 THEN 'ماهر فوزي' WHEN 8 THEN 'نادر حمدي' WHEN 9 THEN 'هاشم رفعت'
        WHEN 10 THEN 'عاصم شوقي' WHEN 11 THEN 'قاسم جلال' WHEN 12 THEN 'رائد بهاء'
        WHEN 13 THEN 'سراج ضياء' WHEN 14 THEN 'واصل نصر' WHEN 15 THEN 'غالب فريد'
      END,
      '010' || LPAD((50000000 + i)::text, 8, '0'),
      '011' || LPAD((60000000 + i)::text, 8, '0'),
      ('2018-' || LPAD(((i % 12) + 1)::text, 2, '0') || '-20')::date,
      CASE WHEN i <= 8 THEN v_g5 ELSE v_g6 END,
      ('2026-03-' || LPAD(((i % 28) + 1)::text, 2, '0'))::date,
      'active',
      'monthly',
      CASE WHEN i <= 8 THEN 400 ELSE 500 END,
      NULL
    ) RETURNING id INTO v_p;
    v_players := v_players || v_p;
  END LOOP;

  -- ============ ATTENDANCE (last 4 weeks for all players) ============
  FOR i IN 1..array_length(v_players, 1) LOOP
    -- 12 sessions per player over last 4 weeks
    INSERT INTO attendance (player_id, branch_id, session_date, status, recorded_by)
    SELECT
      v_players[i],
      (SELECT branch_id FROM players WHERE id = v_players[i]),
      d::date,
      CASE
        WHEN random() < 0.7 THEN 'present'::attendance_status
        WHEN random() < 0.85 THEN 'late'::attendance_status
        ELSE 'absent'::attendance_status
      END,
      p_owner_id
    FROM generate_series(
      CURRENT_DATE - INTERVAL '28 days',
      CURRENT_DATE - INTERVAL '1 day',
      '2 days'
    ) AS d
    ON CONFLICT (player_id, session_date) DO NOTHING;
  END LOOP;

  -- ============ PAYMENTS (partial payments for demo) ============
  FOR i IN 1..array_length(v_players, 1) LOOP
    -- Each player has 2-4 monthly payments
    INSERT INTO payments (player_id, branch_id, amount, payment_date, method, period_covered, recorded_by)
    SELECT
      v_players[i],
      (SELECT branch_id FROM players WHERE id = v_players[i]),
      (SELECT fee_amount FROM players WHERE id = v_players[i]),
      ('2026-0' || m || '-05')::date,
      CASE WHEN random() > 0.5 THEN 'cash'::payment_method ELSE 'transfer'::payment_method END,
      '2026-0' || m,
      p_owner_id
    FROM generate_series(1, 3 + (i % 2)) AS m
    WHERE m <= 5;  -- up to May
  END LOOP;

  -- ============ KIT ITEMS ============
  INSERT INTO kit_items (branch_id, item_name, category, size_options, cost_price, sale_price, stock_quantity, low_stock_threshold) VALUES
    (v_b1, 'طقم الفلانيلا الأساسي', 'kit', ARRAY['S','M','L','XL'], 120, 250, 30, 5),
    (v_b1, 'شورت تدريب', 'training_wear', ARRAY['S','M','L','XL'], 40, 80, 50, 10),
    (v_b1, 'جوارب أكاديمية', 'accessories', ARRAY['S','M','L'], 15, 35, 100, 15),
    (v_b1, 'حقيبة رياضية', 'accessories', ARRAY['واحد'], 60, 120, 20, 3),
    (v_b2, 'طقم الفلانيلا الأساسي', 'kit', ARRAY['S','M','L','XL'], 120, 250, 25, 5),
    (v_b2, 'تيشرت تدريب', 'training_wear', ARRAY['S','M','L','XL'], 50, 100, 40, 8),
    (v_b2, 'جوارب أكاديمية', 'accessories', ARRAY['S','M','L'], 15, 35, 80, 15),
    (v_b3, 'طقم الفلانيلا الأساسي', 'kit', ARRAY['S','M','L','XL'], 120, 250, 20, 5),
    (v_b3, 'شورت تدريب', 'training_wear', ARRAY['S','M','L','XL'], 40, 80, 35, 10),
    (v_b3, 'كرة تدريب', 'accessories', ARRAY['4','5'], 80, 150, 15, 3);

  -- ============ EXPENSES ============
  INSERT INTO expenses (branch_id, category, amount, expense_date, notes, recorded_by) VALUES
    (v_b1, 'rent', 15000, '2026-05-01', 'إيجار الملعب - مايو', p_owner_id),
    (v_b1, 'utilities', 2000, '2026-05-15', 'كهرباء ومياه', p_owner_id),
    (v_b1, 'equipment', 3500, '2026-04-20', 'شراء أقماع وأطواق', p_owner_id),
    (v_b2, 'rent', 12000, '2026-05-01', 'إيجار الملعب - مايو', p_owner_id),
    (v_b2, 'utilities', 1500, '2026-05-15', 'كهرباء', p_owner_id),
    (v_b3, 'rent', 10000, '2026-05-01', 'إيجار الملعب - مايو', p_owner_id),
    (v_b3, 'equipment', 2000, '2026-04-10', 'شباك مرمى جديدة', p_owner_id);

  -- Coach advances (for coaches that exist)
  IF p_coach1_id IS NOT NULL THEN
    INSERT INTO coach_advances (coach_id, branch_id, amount, advance_date, notes) VALUES
      (p_coach1_id, v_b1, 1000, '2026-05-10', 'سلفة شخصية');
  END IF;

  RETURN 'Demo data seeded successfully! ' || array_length(v_players, 1) || ' players created.';
END;
$$;

-- ================================================================
-- 10. STORAGE BUCKETS (run separately in Supabase Dashboard)
-- ================================================================
-- Create these buckets via Supabase Dashboard → Storage:
-- 1. 'player-photos' (public)
-- 2. 'invoices' (private, authenticated access)
-- Or use SQL:
INSERT INTO storage.buckets (id, name, public) VALUES
  ('player-photos', 'player-photos', true),
  ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "player_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-photos');
CREATE POLICY "player_photos_auth_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'player-photos' AND auth.role() = 'authenticated');
CREATE POLICY "invoices_auth_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices' AND auth.role() = 'authenticated');
CREATE POLICY "invoices_auth_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'invoices' AND auth.role() = 'authenticated');
