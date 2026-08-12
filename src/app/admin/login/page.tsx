import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — S4DS Events" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect(session.role === "SCANNER" ? "/admin/scan" : "/admin");
  }

  const { next } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">S4DS Events</h1>
          <p className="text-sm text-muted-foreground">Sign in to the admin console</p>
        </div>

        {/* Only forward same-origin paths. An absolute URL — or a
            protocol-relative "//evil.com" — would make this an open redirect. */}
        <LoginForm
          next={next?.startsWith("/") && !next.startsWith("//") ? next : undefined}
        />
      </div>
    </main>
  );
}
