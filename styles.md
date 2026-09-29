# S4DS style kit

Extracted from `events-application` (the public event-page look: dark "void"
ground, bone-white panels, hard black offset shadows, chunky 2–3px borders,
Archivo type). Copy the pieces below into a new project and it renders
pixel-identical. Plain JS (JSX, no TypeScript) throughout.

## Setup

1. `npm i clsx tailwind-merge`
2. Paste the **Theme CSS** block below into your global stylesheet, right
   after `@import "tailwindcss";`
3. Paste the **Font + layout wiring** block into `app/layout.js`
4. Paste the **Components** block into `components/s4ds.js`
5. Wrap any page that should carry the brand look in `<div className="s4ds">`
6. Import what you need: `import { Panel, Chip, BrandButton, SectionHeading } from "./components/s4ds";`

Colors are hex/oklch literals lifted verbatim — don't "simplify" them to
Tailwind defaults, several are hand-tuned for contrast ratios (noted inline).
The offset-shadow style (`--s4ds-shadow`, `-lg`, `-press`) is the signature
look — no blur anywhere in this system.

---

## Theme CSS

```css
:root {
  /* Surfaces */
  --s4ds-void: #252020; /* page ground — warm near-black */
  --s4ds-carbon: #111111; /* deeper well, for insets */
  --s4ds-bone: #f3f3eb; /* the light panel that carries most content */
  --s4ds-paper: #ffffff; /* inputs and QR fields sitting on bone */

  /* Ink */
  --s4ds-ink: #f3f3eb; /* on void — 14.5:1 */
  --s4ds-ink-dim: #b8b5ae; /* on void — 7.4:1 */
  --s4ds-ink-invert: #252020; /* on bone — 14.5:1 */
  --s4ds-ink-invert-dim: #4a4442; /* on bone — 8.4:1 */
  --s4ds-ink-placeholder: #767068; /* still 4.9:1 on white */

  /* Accents. Each pairs with --s4ds-void text, never white — white lands at
     ~3.4:1 on these and fails body copy. */
  --s4ds-orange: #e1652b;
  --s4ds-yellow: #fcc018;
  --s4ds-peri: #7e7fe7;
  --s4ds-purple: #9a69f5;
  --s4ds-green: #17734b; /* bone text on it clears 4.5:1 */

  /* Structure */
  --s4ds-edge: #000000;
  --s4ds-shadow: 4px 4px 0 var(--s4ds-edge);
  --s4ds-shadow-lg: 7px 7px 0 var(--s4ds-edge);
  --s4ds-shadow-press: 1px 1px 0 var(--s4ds-edge);

  --s4ds-r-sm: 2px;
  --s4ds-r: 6px;
  --s4ds-r-lg: 12px;

  --s4ds-ease: cubic-bezier(0.25, 1, 0.5, 1);
}

.s4ds {
  background-color: var(--s4ds-void);
  color: var(--s4ds-ink);
  font-family: var(--font-archivo), ui-sans-serif, system-ui, sans-serif;
  line-height: 1.65; /* light type on dark reads a weight lighter; this corrects it */
}

html:has(.s4ds),
body:has(.s4ds) {
  background-color: var(--s4ds-void); /* paints the iOS overscroll gutter too */
}

.s4ds ::selection {
  background-color: var(--s4ds-yellow);
  color: var(--s4ds-void);
}

.s4ds :focus-visible {
  outline: 3px solid var(--s4ds-yellow);
  outline-offset: 2px;
  border-radius: var(--s4ds-r-sm);
}

/* Blueprint grid behind a hero section — fades downward via a mask on the
   pseudo-element (masking the section itself would fade the copy too). */
.s4ds-grid {
  position: relative;
  isolation: isolate;
}

.s4ds-grid::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--s4ds-ink) 9%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--s4ds-ink) 9%, transparent) 1px, transparent 1px);
  background-size: 72px 72px;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 92%);
  mask-image: linear-gradient(to bottom, #000 0%, transparent 92%);
}

/* List entrance. A keyframe, not a class-gated transition, so it fires on
   load even in headless renderers. */
@keyframes s4ds-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.s4ds-rise {
  animation: s4ds-rise 0.5s var(--s4ds-ease) both;
  animation-delay: calc(var(--i, 0) * 70ms);
}

@media (prefers-reduced-motion: reduce) {
  .s4ds-rise {
    animation: none;
  }
  .s4ds *,
  .s4ds *::before,
  .s4ds *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

---

## Font + layout wiring

`app/layout.js`:

```jsx
import { Archivo } from "next/font/google";
import "./globals.css"; // must import the Theme CSS above after `@import "tailwindcss";`

// Archivo is the brand's typeface. Load 400–900: 900 for display type,
// 400 for body, no middle ground in the identity.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata = {
  title: "Your Portal Name",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
```

Page/section shell — wrap whatever should carry the brand look:

```jsx
export function BrandShell({ children }) {
  return <div className="s4ds flex min-h-svh flex-col">{children}</div>;
}
```

---

## Components

`components/s4ds.js`:

```jsx
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/* Accents ------------------------------------------------------------ */

const ACCENT_BG = {
  yellow: "bg-[var(--s4ds-yellow)]",
  orange: "bg-[var(--s4ds-orange)]",
  peri: "bg-[var(--s4ds-peri)]",
  purple: "bg-[var(--s4ds-purple)]",
  green: "bg-[var(--s4ds-green)]",
};

const ACCENT_FG = {
  yellow: "text-[var(--s4ds-void)]",
  orange: "text-[var(--s4ds-void)]",
  peri: "text-[var(--s4ds-void)]",
  purple: "text-[var(--s4ds-void)]",
  green: "text-[var(--s4ds-bone)]",
};

const ACCENT_BORDER = {
  yellow: "border-[var(--s4ds-yellow)]",
  orange: "border-[var(--s4ds-orange)]",
  peri: "border-[var(--s4ds-peri)]",
  purple: "border-[var(--s4ds-purple)]",
  green: "border-[var(--s4ds-green)]",
};

const ACCENT_TINT = {
  yellow: "bg-[color-mix(in_srgb,var(--s4ds-yellow)_12%,transparent)]",
  orange: "bg-[color-mix(in_srgb,var(--s4ds-orange)_12%,transparent)]",
  peri: "bg-[color-mix(in_srgb,var(--s4ds-peri)_12%,transparent)]",
  purple: "bg-[color-mix(in_srgb,var(--s4ds-purple)_12%,transparent)]",
  green: "bg-[color-mix(in_srgb,var(--s4ds-green)_12%,transparent)]",
};

export function accentBlock(accent) {
  return cn(ACCENT_BG[accent], ACCENT_FG[accent]);
}

export function accentFill(accent) {
  return ACCENT_BG[accent];
}

// Purple is deliberately excluded from the cycle: void text on it lands at
// 4.3:1, fine for rules/dots but short for small labels on filled tiles.
export function accentAt(index) {
  const cycle = ["orange", "yellow", "peri"];
  return cycle[index % cycle.length];
}

/* Panel ---------------------------------------------------------------- */

const PANEL_BASE =
  "border-[3px] border-[var(--s4ds-edge)] rounded-[var(--s4ds-r)] shadow-[var(--s4ds-shadow)]";

export function Panel({ tone = "bone", className, ...props }) {
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

export function PanelLink({ className, ...props }) {
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

/* Chip / Slab ------------------------------------------------------------ */

export function Chip({ accent, className, ...props }) {
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

export function Slab({ accent = "yellow", className, ...props }) {
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

/* Buttons ------------------------------------------------------------ */

const BUTTON_VARIANT = {
  primary: "bg-[var(--s4ds-yellow)] text-[var(--s4ds-void)]",
  accent: "bg-[var(--s4ds-orange)] text-[var(--s4ds-void)]",
  bone: "bg-[var(--s4ds-bone)] text-[var(--s4ds-ink-invert)]",
  outline: "bg-transparent text-[var(--s4ds-ink)] border-[var(--s4ds-ink)] hover:bg-[var(--s4ds-ink)]/10",
};

export function BrandButton({ variant = "primary", size = "md", className, type = "button", ...props }) {
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

/* Form controls ------------------------------------------------------------ */

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

export function BrandInput({ className, ...props }) {
  return <input className={cn(CONTROL_BASE, "h-12", className)} {...props} />;
}

export function BrandTextarea({ className, ...props }) {
  return <textarea className={cn(CONTROL_BASE, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function BrandSelect({ className, ...props }) {
  return <select className={cn(CONTROL_BASE, "h-12", className)} {...props} />;
}

export function BrandLabel({ className, ...props }) {
  return (
    <label
      className={cn("block text-sm font-bold uppercase tracking-[0.04em] text-[var(--s4ds-ink-invert)]", className)}
      {...props}
    />
  );
}

export function Req() {
  return (
    <span aria-hidden className="ml-1 text-[var(--s4ds-orange)]">
      *
    </span>
  );
}

/* Notices ------------------------------------------------------------ */

export function Notice({ accent = "yellow", className, ...props }) {
  return (
    <div
      className={cn("rounded-[var(--s4ds-r-sm)] border-2 px-4 py-3 text-sm", ACCENT_BORDER[accent], ACCENT_TINT[accent], className)}
      {...props}
    />
  );
}

/* Heading ------------------------------------------------------------ */

export function SectionHeading({ accent = "yellow", count, children }) {
  return (
    <div className="flex items-end gap-4">
      <h2 className="text-2xl font-black tracking-[-0.02em] sm:text-3xl">{children}</h2>
      {typeof count === "number" ? (
        <span className="mb-1 text-sm font-bold tabular-nums text-[var(--s4ds-ink-dim)]">{count}</span>
      ) : null}
      <span aria-hidden className={cn("mb-2.5 h-[3px] flex-1 rounded-full", ACCENT_BG[accent])} />
    </div>
  );
}
```
