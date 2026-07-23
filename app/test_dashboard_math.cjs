const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDashboardMath() {
  console.log('--- Testing Actual Dashboard Math for July 2026 ---');

  // 1. Fetch payments for July 2026
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('id, amount, branch_id, period_covered, player_id, players(payment_type, fee_amount_periodic)')
    .gte('payment_date', '2026-07-01')
    .lte('payment_date', '2026-07-31');

  if (pErr) {
    console.error('Error fetching payments:', pErr);
    return;
  }

  let totalMonthlyCollected = 0;
  let totalLeagueCollected = 0;

  (payments || []).forEach(p => {
    const isLeague = p.players?.payment_type === 'quarterly' || Number(p.players?.fee_amount_periodic || 0) > 0;
    if (isLeague) {
      totalLeagueCollected += Number(p.amount || 0);
    } else {
      totalMonthlyCollected += Number(p.amount || 0);
    }
  });

  console.log(`Total Payments Count: ${payments ? payments.length : 0}`);
  console.log(`Actual Monthly Subscriptions Collected: ${totalMonthlyCollected} EGP`);
  console.log(`Actual League Subscriptions Collected: ${totalLeagueCollected} EGP`);
  console.log(`Total Revenue Combined: ${totalMonthlyCollected + totalLeagueCollected} EGP`);

  // 2. Expenses and Salaries for July 2026
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .gte('expense_date', '2026-07-01')
    .lte('expense_date', '2026-07-31');

  const { data: salaries } = await supabase
    .from('coach_payroll')
    .select('total_salary')
    .eq('month', '2026-07');

  const totalExp = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalSal = (salaries || []).reduce((s, c) => s + Number(c.total_salary || 0), 0);

  console.log(`Total Expenses: ${totalExp} EGP`);
  console.log(`Total Salaries: ${totalSal} EGP`);
  console.log(`Net Profit = (${totalMonthlyCollected + totalLeagueCollected}) - (${totalExp + totalSal}) = ${totalMonthlyCollected + totalLeagueCollected - totalExp - totalSal} EGP`);
}

testDashboardMath();
