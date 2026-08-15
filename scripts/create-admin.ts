import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const email = "admin@kjsit.org";
  const password = "password123";

  console.log(`Creating or updating admin user: ${email}...`);

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from("admin_users")
    .upsert({
      email,
      name: "Admin User",
      role: "OWNER",
      password_hash
    }, { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    console.error("Failed to create admin user:", error);
    return;
  }

  console.log("\nAdmin user ready!");
  console.log("Email:", email);
  console.log("Password:", password);
}

main();
