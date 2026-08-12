import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

/**
 * The signed-in admin shell.
 *
 * It lives in an `(app)` route group specifically so it does NOT wrap
 * /admin/login. When the login page was inside this layout, the redirect below
 * fired on the login page itself and bounced it to /admin/login forever.
 *
 * The proxy already redirects unauthenticated users; this covers the cookie
 * expiring between requests, and gives us the session for the nav anyway.
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
            {/* Registrations aren't a top-level destination — they belong to an
                event, so you reach them by opening one. */}
            {isAdmin ? (
              <>
                <Link href="/admin" className="hover:text-foreground">
                  Events
                </Link>
                <Link href="/admin/emails" className="hover:text-foreground">
                  Email
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
