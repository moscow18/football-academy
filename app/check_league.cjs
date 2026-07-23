const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectLeaguePlayers() {
  console.log('--- Inspecting Players & Payments for League ---');
  
  // 1. Fetch all players with fee_amount_periodic > 0 or payment_type = quarterly
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, full_name, player_code, branch_id, fee_amount_periodic, payment_type, registration_date')
    .or('payment_type.eq.quarterly,fee_amount_periodic.gt.0');

  if (pErr) {
    console.error('Error fetching league players:', pErr);
    return;
  }

  console.log(`Found ${players ? players.length : 0} league players.`);

  if (players && players.length > 0) {
    const playerIds = players.map(p => p.id);
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('id, player_id, amount, payment_date, period_covered, notes')
      .in('player_id', playerIds);

    console.log(`Found ${payments ? payments.length : 0} payments for league players.`);
    
    // Check payments per player
    const paidPlayerIds = new Set((payments || []).map(p => p.player_id));
    console.log(`Unique league players with payments: ${paidPlayerIds.size} / ${players.length}`);
    
    const unpaidPlayers = players.filter(p => !paidPlayerIds.has(p.id));
    console.log(`Unpaid league players count: ${unpaidPlayers.length}`);
    if (unpaidPlayers.length > 0) {
      console.log('Sample unpaid league players:', unpaidPlayers.slice(0, 5));
    }
  }
}

inspectLeaguePlayers();
