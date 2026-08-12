import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

/**
 * Middleware already redirects unauthenticated users, but this layout also
 * covers the case where middleware is bypassed or the cookie expires between
 * requests. Cheap, and it gives us the session for the nav anyway.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const isAdmin = hasRole(session.role, "ADMIN");

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/admin" className="font-semibold tracking-tight">
            S4DS Events
          </Link>

          <nav className="flex flex-1 items-center gap-4 text-sm text-muted-foreground">
            {isAdmin ? (
              <>
                <Link href="/admin" className="hover:text-foreground">
                  Events
                </Link>
                <Link href="/admin/registrations" className="hover:text-foreground">
                  Registrations
                </Link>
              </>
            ) : null}
            <Link href="/admin/scan" className="hover:text-foreground">
              Scanner
            </Link>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {session.name} · {session.role}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
