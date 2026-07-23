const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugLeague() {
  console.log('=== DEBUG LEAGUE SUBSCRIPTIONS & PAYMENTS ===');

  // Try fetching rpc_debt_list
  const { data: debtList, error: dErr } = await supabase.rpc('rpc_debt_list', { p_branch_id: null });
  console.log('rpc_debt_list total items:', debtList?.length, dErr);

  if (debtList) {
    const leagueDebtItems = debtList.filter(d => d.payment_type === 'quarterly' || Number(d.fee_amount_periodic || 0) > 0);
    console.log(`Found ${leagueDebtItems.length} league players in rpc_debt_list.`);
    if (leagueDebtItems.length > 0) {
      console.log('Sample league debt item:', leagueDebtItems[0]);
    }
  }

  // Fetch players with payment_type = quarterly or fee_amount_periodic > 0
  const { data: leaguePlayers, error: lpErr } = await supabase
    .from('players')
    .select('id, full_name, payment_type, fee_amount_periodic, branch_id')
    .or('payment_type.eq.quarterly,fee_amount_periodic.gt.0');

  console.log(`Found ${leaguePlayers?.length || 0} league players in players table.`, lpErr);
  if (leaguePlayers && leaguePlayers.length > 0) {
    console.log('Sample league player:', leaguePlayers[0]);
    const leaguePlayerIds = leaguePlayers.map(p => p.id);

    // Fetch payments for these league players
    const { data: leaguePayments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .in('player_id', leaguePlayerIds);

    console.log(`Found ${leaguePayments?.length || 0} total payments for league players in payments table.`, payErr);
    if (leaguePayments && leaguePayments.length > 0) {
      console.log('Sample league payment:', leaguePayments[0]);
    }
  }

  // Fetch all payments for period_covered = '2026-07'
  const { data: julyPayments } = await supabase
    .from('payments')
    .select('id, amount, notes, period_covered, player_id, players(id, full_name, payment_type, fee_amount_periodic)')
    .eq('period_covered', '2026-07')
    .limit(50);

  console.log(`July 2026 payments count: ${julyPayments?.length || 0}`);
  if (julyPayments && julyPayments.length > 0) {
    let leaguePaymentCount = 0;
    julyPayments.forEach(p => {
      const pObj = Array.isArray(p.players) ? p.players[0] : p.players;
      const isLeague = pObj?.payment_type === 'quarterly' || Number(pObj?.fee_amount_periodic || 0) > 0 || (p.notes || '').includes('دوري');
      if (isLeague) leaguePaymentCount++;
    });
    console.log(`In July 2026 sample, ${leaguePaymentCount} payments identified as league.`);
  }
}

debugLeague();
