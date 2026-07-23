const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deepCheck() {
  console.log('=== DEEP DIAGNOSTIC OF LEAGUE PAYMENTS & DASHBOARD ===');

  // Let's create an auth user session if possible or sign in
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'Password123!'
  });
  console.log('Auth result:', auth?.user?.email, authErr?.message);

  // 1. Fetch all players
  const { data: players } = await supabase.from('players').select('id, full_name, payment_type, fee_amount_periodic, branch_id');
  console.log('Total players found:', players?.length);

  const leaguePlayers = (players || []).filter(p => p.payment_type === 'quarterly' || Number(p.fee_amount_periodic || 0) > 0);
  console.log(`Total league players: ${leaguePlayers.length}`);

  const leagueIds = new Set(leaguePlayers.map(p => p.id));

  // 2. Fetch all payments
  const { data: payments } = await supabase.from('payments').select('id, player_id, amount, payment_date, period_covered, notes');
  console.log('Total payments found:', payments?.length);

  if (payments && payments.length > 0) {
    const periodCoveredMap = {};
    let totalLeagueMoney = 0;

    payments.forEach(p => {
      const isLeague = leagueIds.has(p.player_id) || (p.notes || '').includes('دوري') || (p.notes || '').includes('الدوري');
      if (isLeague) {
        totalLeagueMoney += Number(p.amount || 0);
        periodCoveredMap[p.period_covered] = (periodCoveredMap[p.period_covered] || 0) + Number(p.amount || 0);
      }
    });

    console.log('League payments breakdown by period_covered:', periodCoveredMap);
    console.log(`Total league money across all time: ${totalLeagueMoney} EGP`);
  }
}

deepCheck();
