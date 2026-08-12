/**
 * Events live at the ROOT of the site (/llm-masterclass), which puts them in
 * the same namespace as our real routes.
 *
 * If an event were slugged "admin", Next.js would serve the real /admin route
 * and the event would be permanently unreachable — with no error anywhere.
 * That is very hard to debug after the fact, so we block it at creation time.
 *
 * Enforced in the Zod schema (src/lib/validation.ts), not just in the UI.
 */
export const RESERVED_SLUGS = new Set([
  // real routes
  "admin",
  "api",
  "t",
  "retrieve",
  "login",
  "logout",
  // framework / static
  "_next",
  "static",
  "assets",
  "images",
  "public",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  // reserved for future pages — cheaper to block now than to migrate a live URL
  "about",
  "contact",
  "privacy",
  "terms",
  "help",
  "docs",
  "health",
  "events",
  "new",
  "edit",
  "settings",
  "search",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** "LLM Masterclass 2026!" -> "llm-masterclass-2026" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
