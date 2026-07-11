-- ================================================================
-- تحديث دالة rpc_debt_list — فصل حسابات الشهري عن الدوري
-- انسخ الكود ده وشغّله في Supabase SQL Editor
-- ================================================================

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
  -- الحسابات الكلية (للتوافق مع الأكواد القديمة)
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
    -- total_expected (كلي — للتوافق)
    (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0))::numeric AS total_expected,
    total_paid,
    -- debt (كلي — للتوافق)
    GREATEST(0, (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid))::numeric AS debt,
    -- المتوقع الشهري فقط
    (fee_amount * months_enrolled)::numeric AS total_expected_monthly,
    -- مديونية الشهري = المتوقع الشهري - المدفوع (بحد أقصى المتوقع الشهري)
    GREATEST(0, LEAST(fee_amount * months_enrolled, fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid))::numeric AS debt_monthly,
    -- المتوقع الدوري فقط
    (fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0))::numeric AS total_expected_periodic,
    -- مديونية الدوري = الباقي من المديونية الكلية بعد خصم مديونية الشهري
    GREATEST(0, (fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid) - LEAST(fee_amount * months_enrolled, GREATEST(0, fee_amount * months_enrolled + fee_amount_periodic * CEIL(months_enrolled::numeric / 3.0) - total_paid)))::numeric AS debt_periodic,
    last_payment_date,
    -- next_payment_date calculation
    (registration_date + (months_enrolled * INTERVAL '1 month'))::date AS next_payment_date
  FROM player_stats
  ORDER BY debt DESC;
$$;
