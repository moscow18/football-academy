const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function settleGreenHillsAndRoyal() {
  console.log('--- Step 1: Finding Branches ---');
  const { data: branches, error: bErr } = await supabase.from('branches').select('id, name');
  if (bErr) {
    console.error('Error fetching branches:', bErr);
    return;
  }
  console.log('Branches in DB:', branches);

  const targetBranches = branches.filter(b => 
    b.name.includes('جرين') || b.name.includes('رويال') || b.name.toLowerCase().includes('green') || b.name.toLowerCase().includes('royal')
  );

  console.log('Matched Target Branches:', targetBranches);

  if (targetBranches.length === 0) {
    console.log('No matching branches found for جرين هيلز or رويال');
    return;
  }

  const targetBranchIds = targetBranches.map(b => b.id);

  // Step 2: Fetch active players in these branches
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, full_name, branch_id, fee_amount')
    .eq('status', 'active')
    .in('branch_id', targetBranchIds);

  if (pErr) {
    console.error('Error fetching players:', pErr);
    return;
  }

  console.log(`Found ${players ? players.length : 0} active players in target branches.`);

  if (!players || players.length === 0) {
    console.log('No active players found to settle.');
    return;
  }

  // Step 3: Insert payments for July 2026 (2026-07)
  const todayStr = new Date().toISOString().split('T')[0];
  const newPayments = players.map(p => ({
    player_id: p.id,
    branch_id: p.branch_id,
    amount: Number(p.fee_amount || 600),
    payment_date: todayStr,
    method: 'cash',
    period_covered: '2026-07',
    notes: 'سداد اشتراك شهر يوليو 2026 آلياً لفرعي جرين هيلز ورويال',
  }));

  const { data: inserted, error: payErr } = await supabase.from('payments').insert(newPayments).select();

  if (payErr) {
    console.error('Error inserting payments:', payErr);
  } else {
    console.log(`SUCCESSFULLY SETTLED JULY 2026 FOR ${newPayments.length} PLAYERS IN GREEN HILLS & ROYAL!`);
  }
}

settleGreenHillsAndRoyal();
