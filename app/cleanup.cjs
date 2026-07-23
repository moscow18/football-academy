const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findUsers() {
  const emails = ['owner@vfc.com', 'admin@vfc.com', 'admin@academy.com', 'owner@academy.com', 'manager@vfc.com'];
  for (const email of emails) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: 'Password123!' });
    if (!error && data.user) {
      console.log('SUCCESS LOGIN:', email);
      return data;
    }
  }
  console.log('None of the default passwords worked. Creating admin token or checking public data...');
}

findUsers();
