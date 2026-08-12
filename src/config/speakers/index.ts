/**
 * Who's speaking at each event, keyed by `Event.slug`.
 *
 * Same reasoning as the form registry: this is content that changes once per
 * event and is easier to review in a diff than in a table. No migration, no
 * admin screen.
 *
 * Photos are committed under `public/speakers/` rather than hotlinked. The
 * LinkedIn CDN signs its image URLs with an expiry, so a linked photo would
 * silently turn into a broken image a few months out.
 */
export type Speaker = {
  name: string;
  /**
   * One line under the name: role, company, or what they'll cover. Renders in
   * regular weight against the name's black, so keep it short — it's the
   * quiet half of the pair, not a bio.
   */
  role?: string;
  /** Path under `public/`. Square images look best; they render in a square. */
  photo: string;
  linkedin: string;
  /** Personal site. Optional: not everyone has one, and the icon is dropped. */
  portfolio?: string;
};

export const SPEAKERS: Record<string, Speaker[]> = {
  "ai-agents-workshop": [
    {
      name: "Riddhesh Chaudhary",
      role: "Technical Lead, S4DS",
      photo: "/speakers/riddhesh-chaudhary.jpg",
      linkedin: "https://www.linkedin.com/in/riddheshchaudhary/",
      portfolio: "https://riddhesh.me/",
    },
    {
      name: "Maria Kevin",
      role: "Backend Engineer",
      photo: "/speakers/maria-kevin2.jpg",
      linkedin: "https://www.linkedin.com/in/kvnn/",
      portfolio: "https://mariakevin.in/",
    },
  ],
};

/**
 * Unlike `getFormFields`, an unknown slug is not an error here: most events
 * simply don't list speakers, and the section is omitted when the list is empty.
 */
export function getSpeakers(slug: string): Speaker[] {
  return SPEAKERS[slug] ?? [];
}
