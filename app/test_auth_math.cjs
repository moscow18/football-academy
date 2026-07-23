const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectPayments() {
  await supabase.auth.signInWithPassword({ email: 'ramycaptain@gmail.com', password: 'ramy2024' });

  const { data: sample, error } = await supabase.from('payments').select('id, amount, payment_date, period_covered, player_id').limit(5);
  console.log('Sample payments:', sample);
  console.log('Error if any:', error);

  const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true });
  console.log('Total payments count:', count);
}

inspectPayments();
