/**
 * Problem statements a hackathon runs on, keyed by `Event.slug`.
 *
 * Same reasoning as the form and speaker registries: content that changes once
 * per event, easier to review in a diff than in a table. No migration, no admin
 * screen.
 *
 * This is the SINGLE SOURCE. The event page renders these as cards and the
 * registration form builds its dropdown from the same array — a statement that
 * exists on the page but not in the dropdown is a statement nobody can pick.
 */

export type ProblemStatement = {
  /** The heading, as published. */
  title: string;
  /** One line on what a team would actually be working on. */
  blurb: string;
};

/**
 * The twelve topics from the WRC/ICSSR call for research on *Learnings from
 * Organization of Mahakumbh*, in their published order.
 *
 * The titles are verbatim and the order is load-bearing — teams pick by number,
 * and the outcome goes back to the Government of Maharashtra against these
 * exact headings. Reword a title and every answer already collected points at
 * a statement that no longer exists.
 */
const MAHAKUMBH: ProblemStatement[] = [
  {
    title: "Finance aspect of Mahakumbh",
    blurb: "What it costs to run, where the money comes from, and what it returns to the region.",
  },
  {
    title: "Planning and organization of Mahakumbh",
    blurb: "How an event on this scale is sequenced, staffed and coordinated across agencies.",
  },
  {
    title: "Critical analysis of the supply chain issues in Mahakumbh",
    blurb: "Moving food, water, fuel and materials to a city that exists for six weeks.",
  },
  {
    title: "Management of transportation during Mahakumbh",
    blurb: "Rail, road and pedestrian flow for crowds that arrive in waves, not evenly.",
  },
  {
    title: "Planning for important aspects such as Shahi Snan (शाही स्नान)",
    blurb: "The peak-density days, when everything that can go wrong does so at once.",
  },
  {
    title: "Human resources planning regarding the Mahakumbh",
    blurb: "Recruiting, training and rostering tens of thousands of temporary workers.",
  },
  {
    title: "Role of local government in Mahakumbh",
    blurb: "What the municipal layer owns, and where it hands off to the state.",
  },
  {
    title: "Life experiences of visitors to Mahakumbh",
    blurb: "What the event is like from inside the crowd — access, safety, dignity, cost.",
  },
  {
    title: "Science / Scientific angle of Mahakumbh",
    blurb: "Water quality, sanitation, public health and environmental load on the river.",
  },
  {
    title: "Role of Social Media in organizing, managing Mahakumbh",
    blurb: "Crowd information, rumour control and reaching people already on the move.",
  },
  {
    title: "Role of AI in organizing, managing Mahakumbh",
    blurb: "Crowd sensing, forecasting and decision support for the people running the ground.",
  },
  {
    title: "Any other topic in the aspect of Mahakumbh",
    blurb: "Bring your own. Make the case for it in your approach — this one is judged hardest.",
  },
];

export const PROBLEM_STATEMENTS: Record<string, ProblemStatement[]> = {
  "mahakumbh-hackathon": MAHAKUMBH,
};

/**
 * Unlike `getFormFields`, an unknown slug is not an error: most events have no
 * problem statements and the section is omitted when the list is empty.
 */
export function getProblemStatements(slug: string): ProblemStatement[] {
  return PROBLEM_STATEMENTS[slug] ?? [];
}

/**
 * The dropdown / CSV / summary-chart label: "3. Critical analysis of…".
 *
 * Numbered, because the number is how everyone actually refers to a statement —
 * in the room, in the shortlist, and in the admin table sorted by answer.
 */
export function problemStatementOptions(slug: string): string[] {
  return getProblemStatements(slug).map(
    (statement, index) => `${index + 1}. ${statement.title}`,
  );
}
