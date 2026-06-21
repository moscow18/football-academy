const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('Testing SignUp...');
  const email = `test_${Date.now()}@vfc.com`;
  const password = 'Password123!';
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signUpError) {
    console.error('SignUp Error:', signUpError.message);
    return;
  }
  
  console.log('SignUp Success! User ID:', signUpData.user?.id);
  console.log('Email Confirmed At:', signUpData.user?.email_confirmed_at);
  console.log('Confirmed At:', signUpData.user?.confirmed_at);
  
  console.log('\nTesting SignIn...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (signInError) {
    console.error('SignIn Error:', signInError.message);
    return;
  }
  
  console.log('SignIn Success! Session Token:', signInData.session?.access_token.substring(0, 20) + '...');
}

run();
