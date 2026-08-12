import Link from "next/link";
import Image from "next/image";
import logo from "@/../public/s4ds-white.png";

const PARENT_SITE = "https://s4ds.kjsit.org/";

/**
 * Public shell. The `s4ds` class is what switches the whole subtree onto the
 * brand layer in `globals.css`; `/admin` sits outside this group and keeps the
 * neutral shadcn theme.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="s4ds flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-[var(--s4ds-ink)]/15 bg-[var(--s4ds-void)]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="S4DS Events, home"
          >
            <Image
              src={logo}
              alt=""
              width={38}
              height={38}
              priority
              className="size-9 shrink-0"
            />
            <span className="text-base font-black tracking-[-0.01em]">
              Events
            </span>
          </Link>

          <a
            href={PARENT_SITE}
            className="ml-auto text-sm font-bold text-[var(--s4ds-ink-dim)] underline-offset-4 transition-colors hover:text-[var(--s4ds-yellow)] hover:underline"
          >
            s4ds.kjsit.org
            <span aria-hidden> ↗</span>
          </a>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-24 border-t-2 border-[var(--s4ds-ink)]/15">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-[var(--s4ds-ink-dim)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Society for Data Science · K J Somaiya Institute of Technology,
            Mumbai
          </p>
          <a
            href={PARENT_SITE}
            className="font-bold underline-offset-4 transition-colors hover:text-[var(--s4ds-yellow)] hover:underline"
          >
            About S4DS
          </a>
        </div>
      </footer>
    </div>
  );
}
