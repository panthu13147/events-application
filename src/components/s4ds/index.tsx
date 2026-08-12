import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * S4DS brand primitives.
 *
 * Deliberately separate from `@/components/ui/*`. Those are the shadcn set the
 * admin console is built on; restyling them would drag the neutral, dense
 * organiser UI into the brand's chunky borders and hard shadows. These live
 * alongside instead, and only the `(site)` route group imports them.
 *
 * Everything is a plain DOM element — no client-only primitives — so server
 * components (event page, ticket) and client components (registration form)
 * can both use them.
 */

/* -------------------------------------------------------------------------- */
/*                                   Accents                                   */
/* -------------------------------------------------------------------------- */

export type Accent = "yellow" | "orange" | "peri" | "purple" | "green";

const ACCENT_BG: Record<Accent, string> = {
  yellow: "bg-[var(--s4ds-yellow)]",
  orange: "bg-[var(--s4ds-orange)]",
  peri: "bg-[var(--s4ds-peri)]",
  purple: "bg-[var(--s4ds-purple)]",
  green: "bg-[var(--s4ds-green)]",
};

/**
 * Text colour for filled accent blocks. Yellow/orange/peri are light enough
 * that void text clears 4.5:1 and white does not; green is the inverse. Never
 * hard-code a foreground on an accent — read it from here.
 */
const ACCENT_FG: Record<Accent, string> = {
  yellow: "text-[var(--s4ds-void)]",
  orange: "text-[var(--s4ds-void)]",
  peri: "text-[var(--s4ds-void)]",
  purple: "text-[var(--s4ds-void)]",
  green: "text-[var(--s4ds-bone)]",
};

const ACCENT_BORDER: Record<Accent, string> = {
  yellow: "border-[var(--s4ds-yellow)]",
  orange: "border-[var(--s4ds-orange)]",
  peri: "border-[var(--s4ds-peri)]",
  purple: "border-[var(--s4ds-purple)]",
  green: "border-[var(--s4ds-green)]",
};

/** 12% of the accent over the surface — enough to tint, never enough to fight
 *  the text sitting on it. */
const ACCENT_TINT: Record<Accent, string> = {
  yellow: "bg-[color-mix(in_srgb,var(--s4ds-yellow)_12%,transparent)]",
  orange: "bg-[color-mix(in_srgb,var(--s4ds-orange)_12%,transparent)]",
  peri: "bg-[color-mix(in_srgb,var(--s4ds-peri)_12%,transparent)]",
  purple: "bg-[color-mix(in_srgb,var(--s4ds-purple)_12%,transparent)]",
  green: "bg-[color-mix(in_srgb,var(--s4ds-green)_12%,transparent)]",
};

/**
 * Classes for a filled accent block — background plus the foreground that
 * passes on it. Use this anywhere an accent is used as a surface.
 */
export function accentBlock(accent: Accent): string {
  return cn(ACCENT_BG[accent], ACCENT_FG[accent]);
}

/** Just the fill, for decoration that carries no text (rules, dots). */
export function accentFill(accent: Accent): string {
  return ACCENT_BG[accent];
}

/**
 * Rotates accents across a list so repeated rows don't read as one block.
 * Purple is deliberately absent: void text on it lands at 4.3:1, which is fine
 * for the rules and dots it decorates but short for the small labels that ride
 * on the filled date tiles.
 */
export function accentAt(index: number): Accent {
  const cycle: Accent[] = ["orange", "yellow", "peri"];
  return cycle[index % cycle.length];
}

/* -------------------------------------------------------------------------- */
/*                                    Panel                                    */
/* -------------------------------------------------------------------------- */

const PANEL_BASE =
  "border-[3px] border-[var(--s4ds-edge)] rounded-[var(--s4ds-r)] shadow-[var(--s4ds-shadow)]";

/**
 * The workhorse surface: a bone slab with a black edge and a hard offset
 * shadow. No blur anywhere — the parent site's depth is entirely geometric.
 */
export function Panel({
  tone = "bone",
  className,
  ...props
}: React.ComponentProps<"div"> & { tone?: "bone" | "void" }) {
  return (
    <div
      className={cn(
        PANEL_BASE,
        tone === "bone"
          ? "bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)]"
          : "bg-[var(--s4ds-carbon)] text-[var(--s4ds-ink)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A panel that is also a link. Lifts into its own shadow on hover and gets
 * pressed back down on click, so the whole card behaves like one big key.
 */
export function PanelLink({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      className={cn(
        PANEL_BASE,
        "block bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)]",
        "transition-[transform,box-shadow] duration-200 ease-[var(--s4ds-ease)]",
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--s4ds-shadow-lg)]",
        "active:translate-x-[3px] active:translate-y-[3px] active:shadow-[var(--s4ds-shadow-press)]",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Chip                                     */
/* -------------------------------------------------------------------------- */

/**
 * A hard-edged label block. Accent chips always take `--s4ds-void` as their
 * text colour: white on these accents sits near 3.4:1 and fails body copy.
 */
export function Chip({
  accent,
  className,
  ...props
}: React.ComponentProps<"span"> & { accent?: Accent }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--s4ds-r-sm)] border-2 px-2.5 py-1",
        "text-xs font-bold uppercase tracking-[0.04em] leading-none",
        accent
          ? cn(ACCENT_BG[accent], ACCENT_FG[accent], "border-[var(--s4ds-edge)]")
          : "border-[var(--s4ds-ink)]/45 text-[var(--s4ds-ink-dim)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The hero highlight: an accent block sitting behind a run of display type,
 * the way `DATA SCIENCE` is boxed in yellow on the parent site.
 */
export function Slab({
  accent = "yellow",
  className,
  ...props
}: React.ComponentProps<"span"> & { accent?: Accent }) {
  return (
    <span
      className={cn(
        "inline-block border-[3px] border-[var(--s4ds-edge)] shadow-[var(--s4ds-shadow)]",
        ACCENT_BG[accent],
        ACCENT_FG[accent],
        "px-3",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Buttons                                   */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "accent" | "bone" | "outline";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[var(--s4ds-yellow)] text-[var(--s4ds-void)]",
  accent: "bg-[var(--s4ds-orange)] text-[var(--s4ds-void)]",
  bone: "bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)]",
  outline:
    "bg-transparent text-[var(--s4ds-ink)] border-[var(--s4ds-ink)] hover:bg-[var(--s4ds-ink)]/10",
};

export function BrandButton({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--s4ds-r-sm)]",
        "border-[3px] border-[var(--s4ds-edge)] font-bold uppercase tracking-[0.03em]",
        "shadow-[var(--s4ds-shadow)] transition-[transform,box-shadow,background-color]",
        "duration-150 ease-[var(--s4ds-ease)]",
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--s4ds-shadow-lg)]",
        "active:translate-x-[3px] active:translate-y-[3px] active:shadow-[var(--s4ds-shadow-press)]",
        // Disabled keeps the shadow but loses the press: the control should
        // read as present-but-inert, not missing.
        "disabled:pointer-events-none disabled:opacity-55",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-14 px-6 text-base",
        BUTTON_VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                Form controls                                */
/* -------------------------------------------------------------------------- */

/**
 * Inputs live on bone panels, so they invert: white field, black edge, and an
 * inset hard shadow that makes the field read as a cut-out rather than a
 * raised key. Focus swaps it for the yellow ring from the brand layer.
 */
const CONTROL_BASE = cn(
  "w-full rounded-[var(--s4ds-r-sm)] border-[2.5px] border-[var(--s4ds-edge)]",
  "bg-[var(--s4ds-paper)] text-[var(--s4ds-ink-invert)]",
  "px-3 text-base transition-shadow duration-150 ease-[var(--s4ds-ease)]",
  "placeholder:text-[var(--s4ds-ink-placeholder)]",
  "shadow-[inset_2px_2px_0_rgba(0,0,0,0.14)]",
  "focus-visible:shadow-none",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "aria-[invalid=true]:border-[var(--s4ds-orange)]",
  "aria-[invalid=true]:shadow-[inset_2px_2px_0_color-mix(in_srgb,var(--s4ds-orange)_35%,transparent)]",
);

export function BrandInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL_BASE, "h-12", className)} {...props} />;
}

export function BrandTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL_BASE, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function BrandSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(CONTROL_BASE, "h-12", className)} {...props} />;
}

export function BrandLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "block text-sm font-bold uppercase tracking-[0.04em] text-[var(--s4ds-ink-invert)]",
        className,
      )}
      {...props}
    />
  );
}

/** Required-field marker. Orange on bone is 4.8:1, so it carries on its own. */
export function Req() {
  return (
    <span aria-hidden className="ml-1 text-[var(--s4ds-orange)]">
      *
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Notices                                   */
/* -------------------------------------------------------------------------- */

/**
 * Status messaging. Colour is never the only signal — each tone also gets its
 * own leading word from the caller, so it survives a monochrome or
 * colour-blind read.
 */
export function Notice({
  accent = "yellow",
  className,
  ...props
}: React.ComponentProps<"div"> & { accent?: Accent }) {
  return (
    <div
      className={cn(
        "rounded-[var(--s4ds-r-sm)] border-2 px-4 py-3 text-sm",
        ACCENT_BORDER[accent],
        ACCENT_TINT[accent],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Heading                                   */
/* -------------------------------------------------------------------------- */

/**
 * Section heading with the parent site's rule underneath. One consistent
 * cadence for every section instead of an uppercase eyebrow above each one.
 */
export function SectionHeading({
  accent = "yellow",
  count,
  children,
}: {
  accent?: Accent;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-end gap-4">
      <h2 className="text-2xl font-black tracking-[-0.02em] sm:text-3xl">{children}</h2>
      {typeof count === "number" ? (
        <span className="mb-1 text-sm font-bold tabular-nums text-[var(--s4ds-ink-dim)]">
          {count}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn("mb-2.5 h-[3px] flex-1 rounded-full", ACCENT_BG[accent])}
      />
    </div>
  );
}
