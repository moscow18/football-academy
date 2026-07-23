const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLeaguePayments() {
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, period_covered, player_id, players(id, full_name, payment_type, fee_amount_periodic)')
    .eq('period_covered', '2026-07')
    .limit(100);

  console.log('Sample Payments for July 2026:', payments?.length);
  if (payments && payments.length > 0) {
    let leagueCount = 0;
    let monthlyCount = 0;
    let leagueTotal = 0;

    payments.forEach(p => {
      const pObj = Array.isArray(p.players) ? p.players[0] : p.players;
      const isLeague = pObj?.payment_type === 'quarterly' || Number(pObj?.fee_amount_periodic || 0) > 0;
      if (isLeague) {
        leagueCount++;
        leagueTotal += Number(p.amount || 0);
      } else {
        monthlyCount++;
      }
    });

    console.log(`July sample stats: ${monthlyCount} monthly payments, ${leagueCount} league payments totaling ${leagueTotal} EGP`);
    console.log('First payment sample player object:', payments[0]?.players);
  }
}

checkLeaguePayments();
