-- ================================================================
-- 1. إضافة وتحديث يوم تقفيل الشهر المالي للفروع
-- ================================================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS closing_day integer DEFAULT 31;

-- تحديث الفروع الحالية بأيام التقفيل المطلوبة
UPDATE branches SET closing_day = 20 WHERE name LIKE '%الثلاثي%' OR name ILIKE '%Tholathy%';
UPDATE branches SET closing_day = 30 WHERE name LIKE '%جرين هيلز%' OR name ILIKE '%Green Hills%';
UPDATE branches SET closing_day = 31 WHERE name LIKE '%رويال%' OR name ILIKE '%Royal%';

-- جعل القيمة الافتراضية للعمود هي 31 (نهاية الشهر الميلادي)
ALTER TABLE branches ALTER COLUMN closing_day SET DEFAULT 31;
UPDATE branches SET closing_day = 31 WHERE closing_day IS NULL OR closing_day = 1;

-- ================================================================
-- 2. دالة تحويل التاريخ الميلادي إلى الشهر المالي الخاص بالفرع
-- ================================================================
DROP FUNCTION IF EXISTS fn_date_to_financial_month(date, integer);

CREATE OR REPLACE FUNCTION fn_date_to_financial_month(p_date date, p_closing_day integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(
    CASE 
      WHEN p_closing_day IS NULL OR p_closing_day <= 0 OR p_closing_day >= 31 THEN p_date
      WHEN EXTRACT(DAY FROM p_date) > p_closing_day THEN p_date + INTERVAL '1 month'
      ELSE p_date
    END,
    'YYYY-MM'
  );
$$;

-- ================================================================
-- 3. تحديث الدوال المالية لتدعم الشهر المالي الخاص بالفرع
-- ================================================================

-- أ) حساب صافي الأرباح لكل فرع حسب الشهر المالي
DROP FUNCTION IF EXISTS rpc_net_profit(uuid, text);
DROP FUNCTION IF EXISTS rpc_net_profit();

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
      COALESCE(SUM(pl.fee_amount), 0) AS fee_rev
    FROM branches b
    LEFT JOIN players pl ON pl.branch_id = b.id AND pl.status = 'active'
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
    JOIN branches b ON b.id = kp.branch_id
    WHERE fn_date_to_financial_month(kp.purchase_date, b.closing_day) = p_month
      AND (p_branch_id IS NULL OR kp.branch_id = p_branch_id)
    GROUP BY kp.branch_id
  ),
  exp AS (
    SELECT
      e.branch_id AS bid,
      COALESCE(SUM(e.amount), 0) AS total_exp
    FROM expenses e
    JOIN branches b ON b.id = e.branch_id
    WHERE fn_date_to_financial_month(e.expense_date, b.closing_day) = p_month
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

-- ب) حساب الإيرادات الشهرية لكل فرع حسب الشهر المالي
DROP FUNCTION IF EXISTS rpc_monthly_revenue(uuid, text);
DROP FUNCTION IF EXISTS rpc_monthly_revenue();

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
    COALESCE(SUM(pl.fee_amount) FILTER (WHERE pl.id IS NOT NULL), 0) AS fee_revenue,
    COALESCE(SUM(kp.amount_paid) FILTER (WHERE kp.id IS NOT NULL), 0) AS kit_revenue,
    COALESCE(SUM(pl.fee_amount) FILTER (WHERE pl.id IS NOT NULL), 0) +
    COALESCE(SUM(kp.amount_paid) FILTER (WHERE kp.id IS NOT NULL), 0) AS total_revenue
  FROM branches b
  LEFT JOIN players pl ON pl.branch_id = b.id AND pl.status = 'active'
  LEFT JOIN kit_purchases kp ON kp.branch_id = b.id
    AND fn_date_to_financial_month(kp.purchase_date, b.closing_day) = p_month
  WHERE (p_branch_id IS NULL OR b.id = p_branch_id)
  GROUP BY b.id, b.name;
$$;

-- ج) حساب تريند الإيرادات للشهور الستة الماضية لكل فرع حسب شهره المالي
DROP FUNCTION IF EXISTS rpc_revenue_trend(uuid);
DROP FUNCTION IF EXISTS rpc_revenue_trend();

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
    AND fn_date_to_financial_month(p.payment_date, b.closing_day) = mo.m
  LEFT JOIN kit_purchases kp ON kp.branch_id = b.id
    AND fn_date_to_financial_month(kp.purchase_date, b.closing_day) = mo.m
  WHERE (p_branch_id IS NULL OR b.id = p_branch_id)
  GROUP BY mo.m, b.id, b.name
  ORDER BY mo.m, b.name;
$$;

-- د) تحديث دالة كشف مديونيات اللاعبين لتأخذ يوم التقفيل للفروع بالاعتبار بدقة
DROP FUNCTION IF EXISTS rpc_debt_list(uuid);
DROP FUNCTION IF EXISTS rpc_debt_list();

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
  -- الحسابات الكلية
  total_expected numeric,
  total_paid numeric,
  debt numeric,
  -- الحسابات المنفصلة — شهري
  total_expected_monthly numeric,
  debt_monthly numeric,
  -- الحسابات المنفصلة — دوري
  total_expected_periodic numeric,
  debt_periodic numeric,
  -- تواريخ
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
      -- التاريخ الحسابي المؤثر بناءً على يوم تقفيل الفرع
      -- إذا تجاوزنا يوم التقفيل، فإن الشهر المالي القادم يعتبر قد بدأ ويتحمل اللاعب اشتراكاً إضافياً
      ((EXTRACT(YEAR FROM (
          CASE 
            WHEN COALESCE(b.closing_day, 31) > 0 AND COALESCE(b.closing_day, 31) < 31 AND EXTRACT(DAY FROM CURRENT_DATE) > b.closing_day 
            THEN CURRENT_DATE + INTERVAL '1 month'
            ELSE CURRENT_DATE
          END
        )) - EXTRACT(YEAR FROM GREATEST(p.registration_date, '2026-07-01'::date))) * 12 
       + EXTRACT(MONTH FROM (
          CASE 
            WHEN COALESCE(b.closing_day, 31) > 0 AND COALESCE(b.closing_day, 31) < 31 AND EXTRACT(DAY FROM CURRENT_DATE) > b.closing_day 
            THEN CURRENT_DATE + INTERVAL '1 month'
            ELSE CURRENT_DATE
          END
        )) - EXTRACT(MONTH FROM GREATEST(p.registration_date, '2026-07-01'::date)) 
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
    -- total_expected (كلي)
    (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0))::numeric AS total_expected,
    total_paid,
    -- debt (كلي)
    GREATEST(0, (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid))::numeric AS debt,
    -- المتوقع الشهري فقط
    (fee_amount * months_enrolled)::numeric AS total_expected_monthly,
    -- مديونية الشهري
    GREATEST(0, LEAST(fee_amount * months_enrolled, fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid))::numeric AS debt_monthly,
    -- المتوقع الدوري فقط
    (fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0))::numeric AS total_expected_periodic,
    -- مديونية الدوري
    GREATEST(0, (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid) - LEAST(fee_amount * months_enrolled, GREATEST(0, fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid)))::numeric AS debt_periodic,
    last_payment_date,
    -- next_payment_date calculation
    (registration_date + (months_enrolled * INTERVAL '1 month'))::date AS next_payment_date
  FROM player_stats
  ORDER BY debt DESC;
$$;

-- هـ) إنشاء دالة دفتر اليومية (Ledger) لدعم الشهور المالية للفروع
DROP FUNCTION IF EXISTS rpc_get_ledger(uuid, text);
DROP FUNCTION IF EXISTS rpc_get_ledger();

CREATE OR REPLACE FUNCTION rpc_get_ledger(
  p_branch_id uuid DEFAULT NULL,
  p_month text DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  transaction_id uuid,
  transaction_date timestamptz,
  transaction_type text,
  category text,
  amount numeric,
  notes text,
  branch_name text,
  person_name text
)
LANGUAGE sql
STABLE
AS $$
  -- المدفوعات (إيرادات)
  SELECT 
    p.id AS transaction_id,
    p.created_at AS transaction_date,
    'income'::text AS transaction_type,
    CASE 
      WHEN p.period_covered IS NOT NULL THEN 'اشتراك (' || p.period_covered || ')'
      ELSE 'اشتراك لاعب'
    END AS category,
    p.amount AS amount,
    p.notes AS notes,
    b.name AS branch_name,
    pl.full_name AS person_name
  FROM payments p
  JOIN branches b ON b.id = p.branch_id
  JOIN players pl ON pl.id = p.player_id
  WHERE (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    AND fn_date_to_financial_month(p.payment_date, b.closing_day) = p_month

  UNION ALL

  -- مبيعات الأطقم (إيرادات)
  SELECT 
    kp.id AS transaction_id,
    kp.created_at AS transaction_date,
    'income'::text AS transaction_type,
    'بيع طقم: ' || ki.item_name AS category,
    kp.amount_paid AS amount,
    kp.notes AS notes,
    b.name AS branch_name,
    pl.full_name AS person_name
  FROM kit_purchases kp
  JOIN branches b ON b.id = kp.branch_id
  JOIN players pl ON pl.id = kp.player_id
  JOIN kit_items ki ON ki.id = kp.kit_item_id
  WHERE (p_branch_id IS NULL OR kp.branch_id = p_branch_id)
    AND fn_date_to_financial_month(kp.purchase_date, b.closing_day) = p_month

  UNION ALL

  -- المصروفات (مصروفات)
  SELECT 
    e.id AS transaction_id,
    e.created_at AS transaction_date,
    'outcome'::text AS transaction_type,
    CASE e.category
      WHEN 'salaries' THEN 'رواتب'
      WHEN 'equipment' THEN 'معدات'
      WHEN 'rent' THEN 'إيجار'
      WHEN 'utilities' THEN 'مرافق'
      WHEN 'kits_stock' THEN 'مخزون أطقم'
      ELSE 'أخرى'
    END AS category,
    e.amount AS amount,
    e.notes AS notes,
    b.name AS branch_name,
    u.full_name AS person_name
  FROM expenses e
  JOIN branches b ON b.id = e.branch_id
  LEFT JOIN users u ON u.id = e.recorded_by
  WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    AND fn_date_to_financial_month(e.expense_date, b.closing_day) = p_month

  UNION ALL

  -- سلف المدربين (مصروفات)
  SELECT 
    ca.id AS transaction_id,
    ca.created_at AS transaction_date,
    'outcome'::text AS transaction_type,
    'سلفة راتب' AS category,
    ca.amount AS amount,
    ca.notes AS notes,
    b.name AS branch_name,
    u.full_name AS person_name
  FROM coach_advances ca
  JOIN branches b ON b.id = ca.branch_id
  JOIN users u ON u.id = ca.coach_id
  WHERE (p_branch_id IS NULL OR ca.branch_id = p_branch_id)
    AND fn_date_to_financial_month(ca.advance_date, b.closing_day) = p_month

  UNION ALL

  -- مدفوعات رواتب المدربين (مصروفات)
  SELECT 
    csp.id AS transaction_id,
    csp.created_at AS transaction_date,
    'outcome'::text AS transaction_type,
    'راتب شهر: ' || csp.payment_month AS category,
    csp.amount AS amount,
    ''::text AS notes,
    b.name AS branch_name,
    u.full_name AS person_name
  FROM coach_salary_payments csp
  JOIN branches b ON b.id = csp.branch_id
  JOIN users u ON u.id = csp.coach_id
  WHERE (p_branch_id IS NULL OR csp.branch_id = p_branch_id)
    AND csp.payment_month = p_month

  ORDER BY transaction_date DESC;
$$;

-- ================================================================
-- 4. إنشاء دوال الأسماء المستعارة (Aliases) المستدعاة من لوحة التحكم
-- ================================================================

DROP FUNCTION IF EXISTS get_monthly_branch_stats(text);
DROP FUNCTION IF EXISTS get_monthly_branch_stats();

CREATE OR REPLACE FUNCTION get_monthly_branch_stats(
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
  SELECT * FROM rpc_net_profit(NULL, p_month);
$$;

DROP FUNCTION IF EXISTS get_revenue_trend(uuid);
DROP FUNCTION IF EXISTS get_revenue_trend();

CREATE OR REPLACE FUNCTION get_revenue_trend(
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
  SELECT * FROM rpc_revenue_trend(p_branch_id);
$$;

-- ================================================================
-- 5. تفعيل التحديث اللحظي (Realtime Replication) على جميع الجداول
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE players, payments, expenses, coach_salary_payments, coach_advances, kit_purchases, kit_items, groups, attendance;

