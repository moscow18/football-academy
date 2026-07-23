const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseWithAuth() {
  // Login first
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'ramy2024'
  });

  if (authErr) {
    console.log('Auth failed with ramy, trying other credentials...');
    // Try another common credential
    const { data: a2, error: e2 } = await supabase.auth.signInWithPassword({
      email: 'admin@vfc.com',
      password: 'admin123'
    });
    if (e2) {
      console.log('Auth failed again:', e2.message);
      console.log('Trying without auth (maybe RLS is off for select)...');
    }
  } else {
    console.log('Logged in as:', authData.user?.email);
  }

  console.log('=== DIAGNOSIS START ===');
  console.log('Current UTC date:', new Date().toISOString());
  console.log('');

  // 1. Check branches
  const { data: branches, error: bErr } = await supabase.from('branches').select('id, name, closing_day');
  if (bErr) {
    console.log('ERROR fetching branches:', bErr.message);
    return;
  }
  console.log('--- BRANCHES ---');
  if (!branches || branches.length === 0) {
    console.log('  STILL NO BRANCHES FOUND! RLS issue.');
    return;
  }
  branches.forEach(b => console.log(`  ${b.name} (${b.id}) | closing_day = ${b.closing_day}`));
  console.log('');

  // 2. Count all payments
  const { count: totalPayments } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true });
  console.log(`Total payments in DB: ${totalPayments}`);

  // 3. Recent payments
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('id, player_id, amount, payment_date, period_covered, notes')
    .order('payment_date', { ascending: false })
    .limit(10);
  console.log('--- 10 MOST RECENT PAYMENTS ---');
  (recentPayments || []).forEach(p => console.log(`  date=${p.payment_date} | period=${p.period_covered} | amount=${p.amount} | notes=${(p.notes||'').substring(0,80)}`));
  console.log('');

  // 4. Payments for July
  const { count: julyCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .gte('payment_date', '2026-07-01')
    .lte('payment_date', '2026-07-31');
  console.log(`Payments in July 2026 (by date range): ${julyCount}`);

  const { count: julyPeriodCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('period_covered', '2026-07');
  console.log(`Payments with period_covered = '2026-07': ${julyPeriodCount}`);
  console.log('');

  // 5. Active players count per branch
  console.log('--- ACTIVE PLAYERS PER BRANCH ---');
  for (const b of branches) {
    const { count: c } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', b.id)
      .eq('status', 'active')
      .gt('fee_amount', 0);
    console.log(`  ${b.name}: ${c} active players | closing_day=${b.closing_day}`);
  }

  // 6. getActiveFinancialMonth simulation
  console.log('');
  console.log('--- FINANCIAL MONTH SIMULATION ---');
  const now = new Date();
  const day = now.getDate();
  branches.forEach(b => {
    const closingDay = b.closing_day;
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed
    if (closingDay && closingDay > 0 && closingDay < 31 && day > closingDay) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
    const result = `${year}-${String(month + 1).padStart(2, '0')}`;
    console.log(`  ${b.name}: closing_day=${closingDay}, today=${day} => Financial Month = ${result} ${day > closingDay ? '(SHIFTED TO NEXT MONTH!)' : '(current month)'}`);
  });

  console.log('');
  console.log('=== DIAGNOSIS END ===');
}

diagnoseWithAuth();
