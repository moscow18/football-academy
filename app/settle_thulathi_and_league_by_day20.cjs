const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSettlement() {
  console.log('=== Starting Thulathi & League Day 20 Settlement ===');

  // 1. Log in
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'ramy2024'
  });

  if (authErr) {
    console.error('Auth login failed:', authErr.message);
    return;
  }
  console.log('Logged in as:', authData.user?.email);

  // 2. Fetch Thulathi branch ID
  const { data: branches } = await supabase.from('branches').select('id, name');
  const thulathiBranch = branches ? branches.find(b => b.name.includes('الثلاثي')) : null;
  const thulathiBranchId = thulathiBranch ? thulathiBranch.id : null;

  console.log('Thulathi Branch ID:', thulathiBranchId);

  // 3. Fetch active players in Thulathi OR League
  let query = supabase
    .from('players')
    .select('id, full_name, branch_id, fee_amount, fee_amount_periodic, payment_type, registration_date, created_at, status')
    .eq('status', 'active');

  const { data: players, error: pErr } = await query;
  if (pErr) {
    console.error('Error fetching players:', pErr);
    return;
  }

  // Filter for Thulathi branch OR League players
  const targetPlayers = (players || []).filter(p => 
    p.branch_id === thulathiBranchId || p.payment_type === 'quarterly' || Number(p.fee_amount_periodic || 0) > 0
  );

  console.log(`Found ${targetPlayers.length} target players (Thulathi + League).`);

  // 4. Fetch existing payments for 2026-07 and 2026-08
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('id, player_id, period_covered')
    .in('period_covered', ['2026-07', '2026-08']);

  const paymentKeySet = new Set(
    (existingPayments || []).map(p => `${p.player_id}_${p.period_covered}`)
  );

  const newPayments = [];
  let julyCount = 0;
  let augustCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const player of targetPlayers) {
    // Determine registration date/day
    const regDateStr = player.registration_date || (player.created_at ? player.created_at.split('T')[0] : '2026-07-01');
    const regDate = new Date(regDateStr);
    const day = regDate.getDate();

    // Rule: day <= 20 -> July 2026. day > 20 -> August 2026.
    const targetPeriod = day <= 20 ? '2026-07' : '2026-08';
    const pKey = `${player.id}_${targetPeriod}`;

    if (!paymentKeySet.has(pKey)) {
      const isLeague = player.payment_type === 'quarterly' || Number(player.fee_amount_periodic || 0) > 0;
      const amount = isLeague 
        ? Number(player.fee_amount_periodic || 1200) 
        : Number(player.fee_amount || 600);

      newPayments.push({
        player_id: player.id,
        branch_id: player.branch_id,
        amount: amount > 0 ? amount : 600,
        payment_date: todayStr,
        method: 'cash',
        period_covered: targetPeriod,
        notes: `تسديد آلي لمرحلة يوم 20 (${day <= 20 ? 'قبل يوم 20 - يوليو' : 'بعد يوم 20 - أغسطس'})`,
      });

      if (targetPeriod === '2026-07') julyCount++;
      else augustCount++;
    }
  }

  console.log(`New payments to insert: ${newPayments.length} (July: ${julyCount}, August: ${augustCount})`);

  if (newPayments.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < newPayments.length; i += 100) {
      const batch = newPayments.slice(i, i + 100);
      const { error: insErr } = await supabase.from('payments').insert(batch);
      if (insErr) {
        console.error('Batch insert error:', insErr);
      }
    }
    console.log('✅ ALL SETTLEMENT PAYMENTS INSERTED SUCCESSFULLY!');
  } else {
    console.log('All target players are already settled according to the Day 20 rule!');
  }

  console.log('=== Settlement Completed ===');
}

runSettlement();
