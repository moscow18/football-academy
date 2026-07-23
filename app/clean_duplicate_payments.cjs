const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanDuplicates() {
  console.log('=== Checking Duplicate Payments ===');

  await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com',
    password: 'ramy2024'
  });

  const { data: payments } = await supabase
    .from('payments')
    .select('id, player_id, period_covered, amount, created_at')
    .order('created_at', { ascending: true });

  if (!payments || payments.length === 0) {
    console.log('No payments found.');
    return;
  }

  console.log(`Total payment records in DB: ${payments.length}`);

  const seenMap = new Map();
  const duplicateIds = [];

  payments.forEach(p => {
    const key = `${p.player_id}_${p.period_covered}`;
    if (seenMap.has(key)) {
      duplicateIds.push(p.id);
    } else {
      seenMap.set(key, p.id);
    }
  });

  console.log(`Found ${duplicateIds.length} duplicate payment records.`);

  if (duplicateIds.length > 0) {
    // Delete duplicate payment records in batches
    for (let i = 0; i < duplicateIds.length; i += 100) {
      const batch = duplicateIds.slice(i, i + 100);
      const { error } = await supabase.from('payments').delete().in('id', batch);
      if (error) console.error('Error deleting batch:', error);
    }
    console.log(`✅ Deleted ${duplicateIds.length} duplicate payment records!`);
  }
}

cleanDuplicates();
