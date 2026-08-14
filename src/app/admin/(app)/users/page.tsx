import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { assignableRoles, canManageRole, hasRole } from "@/lib/session";
import { UsersClient, type AdminUser } from "./UsersClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team" };

/**
 * Creating the SCANNER accounts volunteers sign in with.
 *
 * The proxy already keeps SCANNERs out of every /admin route that isn't
 * /admin/scan, but it only reads the JWT. This re-checks against the database
 * for the same reason requireRole() does — a role change or a deactivation has
 * to bite before the seven-day cookie expires.
 */
export default async function TeamPage() {
  const session = await getActiveSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session.role, "ADMIN")) redirect("/admin/scan");

  const { data, error } = await db
    .from("admin_users")
    .select("id, email, name, role, is_active, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const users: AdminUser[] = (data ?? []).map((user) => ({
    ...user,
    // Mirrors the check in the route handler, so a button only appears when
    // the API would actually honour it.
    can_manage: user.id !== session.sub && canManageRole(session.role, user.role),
    is_self: user.id === session.sub,
  }));

  return <UsersClient users={users} assignable={assignableRoles(session.role)} />;
}
