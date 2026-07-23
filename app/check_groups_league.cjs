const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAll() {
  console.log('=== CHECKING GROUPS AND LEAGUE PLAYERS ===');

  // Fetch groups
  const { data: groups } = await supabase.from('groups').select('*');
  console.log('Groups in DB:', groups?.map(g => ({ id: g.id, name: g.name })));

  // Fetch players sample
  const { data: players } = await supabase.from('players').select('id, full_name, payment_type, fee_amount, fee_amount_periodic, group_id').limit(100);
  console.log('Players sample (first 10):', players?.slice(0, 10));

  // Count non-zero fee_amount_periodic
  const { count: periodicCount } = await supabase.from('players').select('id', { count: 'exact', head: true }).gt('fee_amount_periodic', 0);
  console.log('Players with fee_amount_periodic > 0:', periodicCount);

  // Count payment_type = quarterly
  const { count: quarterlyCount } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('payment_type', 'quarterly');
  console.log('Players with payment_type = quarterly:', quarterlyCount);
}

checkAll();
