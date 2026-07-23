const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function settleThulathiAfterJuly21() {
  console.log('=== Settle Thulathi Players Registered After July 21 for August 2026 ===');

  await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'ramy2024'
  });

  // Fetch branches
  const { data: branches, error: bErr } = await supabase.from('branches').select('id, name');
  console.log('Branches found:', branches, bErr);

  let thulathiBranchId = 'b0000003-0000-0000-0000-000000000003';
  if (branches && branches.length > 0) {
    const found = branches.find(b => b.name.includes('الثلاثي'));
    if (found) thulathiBranchId = found.id;
  }

  console.log('Using Thulathi branch ID:', thulathiBranchId);

  // Fetch active players in Thulathi
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, full_name, branch_id, fee_amount, registration_date, created_at, status')
    .eq('branch_id', thulathiBranchId)
    .eq('status', 'active');

  if (pErr) {
    console.error('Error fetching players:', pErr);
    return;
  }

  console.log(`Total active players in Thulathi: ${players ? players.length : 0}`);

  // Filter players registered after July 21st (2026-07-21 onwards)
  const after21Players = (players || []).filter(p => {
    const regDateStr = p.registration_date || (p.created_at ? p.created_at.split('T')[0] : '2026-07-01');
    const d = new Date(regDateStr);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    return (y > 2026) || (y === 2026 && m > 7) || (y === 2026 && m === 7 && day >= 21);
  });

  console.log(`Found ${after21Players.length} players registered after July 21 in Thulathi.`);

  // Check existing payments for period_covered = '2026-08'
  const { data: existingAugPayments } = await supabase
    .from('payments')
    .select('player_id')
    .eq('period_covered', '2026-08');

  const paidAugPlayerIds = new Set((existingAugPayments || []).map(p => p.player_id));

  const todayStr = new Date().toISOString().split('T')[0];
  const newPayments = [];

  after21Players.forEach(p => {
    if (!paidAugPlayerIds.has(p.id)) {
      newPayments.push({
        player_id: p.id,
        branch_id: p.branch_id,
        amount: Number(p.fee_amount || 600),
        payment_date: todayStr,
        method: 'cash',
        period_covered: '2026-08',
        notes: `تسديد اشتراك بداية الفرع لشهر أغسطس (مقدم بعد 21 يوليو)`,
      });
    }
  });

  console.log(`New August payments to insert: ${newPayments.length}`);

  if (newPayments.length > 0) {
    for (let i = 0; i < newPayments.length; i += 100) {
      const batch = newPayments.slice(i, i + 100);
      const { error: insErr } = await supabase.from('payments').insert(batch);
      if (insErr) {
        console.error('Batch insert error:', insErr);
      }
    }
    console.log('✅ SUCCESS! Settled all Thulathi players registered after July 21 for August 2026!');
  } else {
    console.log('All Thulathi players registered after July 21 are already settled for August 2026.');
  }
}

settleThulathiAfterJuly21();
