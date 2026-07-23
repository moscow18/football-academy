const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jthwlwtgcvwgasvrejue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncInvoices() {
  console.log('=== Syncing Invoices for all 1,130 Existing Payments ===');

  let allPayments = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('id, player_id, branch_id, amount, payment_date, period_covered')
      .order('id')
      .range(from, from + 999);
    
    if (pErr) {
      console.error('Error fetching payments:', pErr);
      break;
    }
    if (payments && payments.length > 0) {
      allPayments = allPayments.concat(payments);
      from += payments.length;
      if (payments.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allPayments.length} total payments in DB.`);

  let allInvoices = [];
  from = 0;
  hasMore = true;

  while (hasMore) {
    const { data: invs, error: iErr } = await supabase
      .from('invoices')
      .select('id, player_id, issued_date, amount')
      .order('id')
      .range(from, from + 999);

    if (iErr) {
      console.error('Error fetching invoices:', iErr);
      break;
    }
    if (invs && invs.length > 0) {
      allInvoices = allInvoices.concat(invs);
      from += invs.length;
      if (invs.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allInvoices.length} existing invoices in DB.`);

  const existingKeys = new Set(
    allInvoices.map(i => `${i.player_id}_${i.issued_date}_${i.amount}`)
  );

  const missingPayments = allPayments.filter(
    p => !existingKeys.has(`${p.player_id}_${p.payment_date}_${p.amount}`)
  );

  console.log(`Found ${missingPayments.length} payments without invoices. Creating them...`);

  if (missingPayments.length === 0) {
    console.log('All payments already have invoices!');
    return;
  }

  const invoiceRows = missingPayments.map((p, idx) => ({
    invoice_number: `INV-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    player_id: p.player_id,
    branch_id: p.branch_id,
    amount: p.amount,
    issued_date: p.payment_date || new Date().toISOString().split('T')[0],
    notes: `فاتورة سداد اشتراك شهر ${p.period_covered || ''}`,
  }));

  for (let i = 0; i < invoiceRows.length; i += 50) {
    const chunk = invoiceRows.slice(i, i + 50);
    const { error: insErr } = await supabase.from('invoices').insert(chunk);
    if (insErr) {
      console.error(`Error inserting chunk starting at ${i}:`, insErr.message);
    } else {
      console.log(`Successfully created chunk of ${chunk.length} invoices (${i + chunk.length}/${invoiceRows.length})`);
    }
  }

  console.log('=== Invoices Sync Complete! ===');
}

syncInvoices();
