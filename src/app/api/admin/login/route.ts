import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const { data: user, error } = await db
    .from("admin_users")
    .select("id, email, name, role, password_hash")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("login lookup failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  // Same message and roughly the same work either way, so the response can't
  // be used to discover which admin emails exist.
  const valid = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    ok: true,
    // Volunteers only have the scanner, so send them straight there.
    redirect: user.role === "SCANNER" ? "/admin/scan" : "/admin",
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
