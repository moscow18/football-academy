const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixRoyal() {
  // Login
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ramycaptain@gmail.com', password: 'ramy2024'
  });
  if (authErr) {
    // try without auth
  }

  // Update Royal closing_day to 1
  const { data, error } = await supabase
    .from('branches')
    .update({ closing_day: 1 })
    .ilike('name', '%رويال%')
    .select();

  if (error) {
    console.log('Error updating Royal:', error.message);
  } else {
    console.log('Updated Royal closing_day to 1:', data);
  }

  // Verify all branches
  const { data: branches } = await supabase.from('branches').select('id, name, closing_day');
  console.log('All branches now:');
  (branches || []).forEach(b => console.log(`  ${b.name} => closing_day = ${b.closing_day}`));
}
fixRoyal();
