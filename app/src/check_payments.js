const URL = "https://jthwlwtgcvwgasvrejue.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHdsd3RnY3Z3Z2FzdnJlanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzc2NTgsImV4cCI6MjA5NzQ1MzY1OH0.ZAmX3Tz8Z45QFaJQPFWeCqE-IGOmuAvc0TuYUHRzj0Y";

async function main() {
  console.log("=== Checking Recent Payments in Database ===");
  try {
    const res = await fetch(`${URL}/rest/v1/payments?select=id,created_at,amount,payment_date,period_covered,player_id,players(full_name,player_code)&order=created_at.desc&limit=15`, {
      headers: {
        "apikey": KEY,
        "Authorization": `Bearer ${KEY}`,
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error fetching payments:", err);
  }
}

main();
