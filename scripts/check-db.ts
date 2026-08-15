import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log("Checking admin_users table...");
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, name, role, is_active, password_hash")
    .limit(1);
    
  if (error) {
    console.error("Error fetching admin_users:", error);
    
    if (error.code === 'PGRST204' || error.code === '42703' || error.message.includes('is_active')) {
       console.log("\nAttempting to reload Supabase schema cache...");
       // This RPC call usually doesn't work unless defined, but let's try
       // A better way is to do it via the dashboard.
    }
  } else {
    console.log("Success! Data:", data);
  }
}

check();
