const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDbData() {
  console.log('=== INSPECTING ALL PLAYERS AND PAYMENTS IN SUPABASE ===');

  // Login
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'ramy2024'
  });
  console.log('Auth result:', auth?.user?.email, authErr?.message);

  // 1. Fetch branches
  const { data: branches } = await supabase.from('branches').select('*');
  console.log('Branches:', branches);

  // 2. Fetch all players
  const { data: players, error: pErr } = await supabase.from('players').select('id, full_name, payment_type, fee_amount, fee_amount_periodic, branch_id');
  console.log(`Total Players count: ${players?.length}`, pErr?.message);

  const quarterlyPlayers = (players || []).filter(p => p.payment_type === 'quarterly' || Number(p.fee_amount_periodic || 0) > 0);
  console.log(`Quarterly / League Players count: ${quarterlyPlayers.length}`);
  if (quarterlyPlayers.length > 0) {
    console.log('Sample Quarterly Player:', quarterlyPlayers[0]);
  }

  // 3. Fetch all payments
  const { data: payments, error: payErr } = await supabase.from('payments').select('*').limit(2000);
  console.log(`Total Payments count: ${payments?.length}`, payErr?.message);

  if (payments && payments.length > 0) {
    console.log('Sample payment:', payments[0]);

    // Check payments matching quarterly players
    const qPlayerIds = new Set(quarterlyPlayers.map(p => p.id));
    const leaguePayments = payments.filter(p => qPlayerIds.has(p.player_id) || (p.notes || '').includes('دوري'));
    console.log(`Total Payments for League Players: ${leaguePayments.length}`);
    if (leaguePayments.length > 0) {
      console.log('Sample League Payment:', leaguePayments[0]);
      const totalLeagueAmount = leaguePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      console.log(`Total amount of all League Payments: ${totalLeagueAmount} EGP`);
    }
  }
}

inspectDbData();
