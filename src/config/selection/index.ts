/**
 * What a registrant is told once an admin approves them, keyed by `Event.slug`.
 *
 * Same reasoning as the community, form and speaker registries: content that
 * changes once per event, easier to review in a diff than in a table.
 *
 * Rendered in the "approved" email only — that's the "you've been selected"
 * moment, and the one email every accepted team is guaranteed to get. The
 * WhatsApp button still comes from `@/config/community`; this is everything
 * else they need to act on before the day.
 *
 * The payload is snapshotted at enqueue (see `emailPayload`), so fix a link
 * here BEFORE approving anyone — changing it afterwards doesn't reach the
 * emails already queued or sent.
 */

export type SelectionLink = {
  /** Where the button goes. An empty url is skipped, never rendered broken. */
  url: string;
  /** Button text. */
  label: string;
  /** One line under the button on what it is / what to do with it. */
  note: string;
};

export type SelectionInfo = {
  /** Replaces the default "You're in" heading. */
  heading: string;
  /** Paragraphs shown above the event details, in order. */
  intro: string[];
  links: SelectionLink[];
  /** Paragraphs shown after the links, in order. */
  outro?: string[];
};

export const SELECTION_INFO: Record<string, SelectionInfo> = {
  "knowbuild-2-0": {
    heading: "Congratulations your team has been selected",
    intro: [
      "Your team has been selected for Knowbuild 2.0, our 8-hour Open Innovation hackathon. We're excited to see what you build!",
      "Please go through everything below before the day the form is mandatory to confirm your team's participation.",
    ],
    links: [
      {
        url: "https://forms.gle/4BdkJvFbnfJkaRiU8",
        label: "Fill the confirmation form",
        note: "Mandatory one submission per team. Unconfirmed teams may lose their spot.",
      },
      {
        url: "https://drive.google.com/file/d/1swgcvJ_tsrU81ymjrooGXNtr-j-iYo2g/view?usp=sharing",
        label: "Read the rulebook",
        note: "Theme, judging criteria, submission format and disqualification rules.",
      },
      {
        url: "https://drive.google.com/file/d/1UUe4JIB7pgLGgHe58ie_l7JVn2waOn44/view?usp=sharing",
        label: "Read the floor guide",
        note: "Reporting time, conduct in the lab, breaks and what to carry.",
      },
    ],
    outro: [
      "Reporting time is 7:00 AM sharp on 26 September. Bring your college ID card, a laptop and a charger.",
      "Questions? Join and Ask in the WhatsApp group.",
    ],
  },
};

/**
 * Unlike `getFormFields`, an unknown slug is not an error: most events send the
 * plain "approved" email and the whole block is omitted.
 */
export function getSelectionInfo(slug: string): SelectionInfo | null {
  const info = SELECTION_INFO[slug];
  if (!info) return null;
  return { ...info, links: info.links.filter((link) => link.url.trim() !== "") };
}
