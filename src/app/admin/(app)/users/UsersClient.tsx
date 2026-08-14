"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminRoleName } from "@/lib/session";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRoleName;
  is_active: boolean;
  created_at: string;
  /** Server-computed from canManageRole() — the row's controls key off this. */
  can_manage: boolean;
  is_self: boolean;
};

const ROLE_BLURB: Record<AdminRoleName, string> = {
  OWNER: "Everything, including deleting registrations",
  ADMIN: "Events, registrations, email and volunteers",
  SCANNER: "The scanner and nothing else",
};

const ROLE_VARIANT: Record<AdminRoleName, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  SCANNER: "outline",
};

function joined(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Shared fetch + refresh so every action reports failure the same way. */
function useAdminUserAction() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    key: string,
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ): Promise<boolean> {
    setBusyId(key);
    setError(null);

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "Something went wrong");
      setBusyId(null);
      return false;
    }

    startTransition(() => {
      router.refresh();
      setBusyId(null);
    });
    return true;
  }

  return { run, busyId, error, setError };
}

export function UsersClient({
  users,
  assignable,
}: {
  users: AdminUser[];
  /** Roles this admin may hand out. Empty means they can only view the list. */
  assignable: AdminRoleName[];
}) {
  const { run, busyId, error, setError } = useAdminUserAction();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AdminRoleName>(
    // Volunteers are the account you create over and over, so default to the
    // least privileged role rather than the first one in the list.
    assignable.includes("SCANNER") ? "SCANNER" : (assignable[0] ?? "SCANNER"),
  );

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);

    const ok = await run("new", "/api/admin/users", "POST", {
      name: values.get("name"),
      email: values.get("email"),
      password: values.get("password"),
      role,
    });

    if (ok) {
      form.reset();
      setOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Accounts that can sign in at /admin. Volunteers get SCANNER, which
            opens the scanner and nothing else. There is no invite email — create
            the account and tell them the password.
          </p>
        </div>

        {assignable.length > 0 ? (
          <Button
            className="gap-2"
            onClick={() => {
              setError(null);
              setOpen((value) => !value);
            }}
          >
            <UserPlus className="size-4" />
            {open ? "Cancel" : "Add account"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {open ? (
        <form
          onSubmit={create}
          className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Event Volunteer" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="volunteer@s4ds.local"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as AdminRoleName)}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name} — {ROLE_BLURB[name]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busyId === "new"}>
              {busyId === "new" ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {user.name}
                {user.is_self ? (
                  <span className="text-xs font-normal text-muted-foreground">you</span>
                ) : null}
                {!user.is_active ? (
                  <Badge variant="destructive" className="shrink-0">
                    Deactivated
                  </Badge>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email} · added {joined(user.created_at)}
              </p>
            </div>

            {user.can_manage ? (
              <RoleSelect user={user} assignable={assignable} run={run} busyId={busyId} />
            ) : (
              <Badge variant={ROLE_VARIANT[user.role]} className="shrink-0">
                {user.role}
              </Badge>
            )}

            {user.can_manage ? (
              <div className="flex items-center gap-2">
                <ResetPasswordButton user={user} run={run} busyId={busyId} />
                <Button
                  size="sm"
                  variant={user.is_active ? "outline" : "default"}
                  disabled={busyId === user.id}
                  onClick={() =>
                    run(user.id, `/api/admin/users/${user.id}`, "PATCH", {
                      is_active: !user.is_active,
                    })
                  }
                >
                  {user.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Changing a role takes effect on the person's next request, not their next
 * login — requireRole() re-reads the row rather than trusting the seven-day
 * JWT. Same for deactivating someone mid-event.
 */
function RoleSelect({
  user,
  assignable,
  run,
  busyId,
}: {
  user: AdminUser;
  assignable: AdminRoleName[];
  run: (key: string, url: string, method: "PATCH", body: unknown) => Promise<boolean>;
  busyId: string | null;
}) {
  return (
    <Select
      value={user.role}
      disabled={busyId === user.id}
      onValueChange={(value) =>
        run(user.id, `/api/admin/users/${user.id}`, "PATCH", { role: value })
      }
    >
      <SelectTrigger size="sm" className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {assignable.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ResetPasswordButton({
  user,
  run,
  busyId,
}: {
  user: AdminUser;
  run: (key: string, url: string, method: "PATCH", body: unknown) => Promise<boolean>;
  busyId: string | null;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={busyId === user.id}
      >
        <KeyRound className="size-3.5" />
        Reset password
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        value={value}
        minLength={8}
        autoComplete="new-password"
        placeholder="New password"
        className="h-8 w-[180px]"
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        size="sm"
        disabled={value.length < 8 || busyId === user.id}
        onClick={async () => {
          const ok = await run(user.id, `/api/admin/users/${user.id}`, "PATCH", {
            password: value,
          });
          if (ok) {
            setValue("");
            setOpen(false);
          }
        }}
      >
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setValue("");
          setOpen(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
