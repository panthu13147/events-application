import type { FieldDef } from "@/lib/form-types";
import { problemStatementOptions } from "@/config/problem-statements";

/**
 * The extra questions each event asks, keyed by `Event.form_key`.
 *
 * There is deliberately no drag-and-drop builder. Adding an event with
 * different questions is a one-line edit here plus a deploy.
 *
 * `full_name`, `email` and `phone` are columns on every registration — they are
 * asked by default and must NOT be repeated here.
 *
 * Rules:
 *  - A `key` is permanent. Renaming it orphans the answers already collected.
 *  - Every key here becomes a CSV column in the admin export.
 */
export const FORMS = {
  /** Internal KJSIT event — students only */
  "kjsit-student": [
    {
      key: "department",
      label: "Department",
      type: "select",
      required: true,
      options: ["AIDS", "COMPS", "IT", "EXTC", "MECH", "ETRX"],
    },
    {
      key: "year",
      label: "Year of Study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE"],
    },
    {
      key: "division",
      label: "Division",
      type: "select",
      required: true,
      options: ["A", "B", "C", "D"],
    },
  ],

  /** Open to students from other colleges and to working professionals */
  "open-public": [
    {
      key: "organization",
      label: "College / Company",
      type: "text",
      required: true,
    },
    {
      key: "role",
      label: "You are a",
      type: "radio",
      required: true,
      options: ["Student", "Working professional", "Other"],
    },
    {
      key: "linkedin",
      label: "LinkedIn profile",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
    },
  ],

  /**
   * AI Agents Workshop, Aug 2026.
   *
   * The last three questions exist for specific reasons, not just to collect
   * data — say so in the hints so people answer honestly:
   *  - own_laptop    -> how many lab machines to reserve
   *  - os            -> which setup/troubleshooting slides to prepare
   *  - python_comfort -> pairing beginners with people who can help
   */
  "ai-agents-workshop": [
    {
      key: "department",
      label: "Department",
      type: "radio",
      required: true,
      options: ["COMPS", "AI-DS", "IT", "EXTC"],
    },
    {
      key: "year",
      label: "Year of Study",
      type: "radio",
      required: true,
      options: ["FY", "SY", "TY", "LY"],
    },
    {
      key: "own_laptop",
      label: "Will you bring your own laptop?",
      type: "radio",
      required: true,
      options: [
        "Yes, I'll bring my own laptop",
        "No, I need a lab machine",
      ],
      hint: "Bringing your own is strongly recommended",
      emphasiseHint: true,
    },
    {
      key: "os",
      label: "Which OS is on your device?",
      type: "radio",
      required: true,
      options: ["Windows", "macOS", "Linux"],
      hint: "So we can prepare the right setup steps for virtualenv activation and install errors.",
    },
    {
      key: "python_comfort",
      label: "How comfortable are you with Python?",
      type: "radio",
      required: true,
      options: [
        "None - complete beginner",
        "Basic - I can read and edit scripts",
        "Comfortable - I write my own",
        "I build stuff regularly",
      ],
      hint: "Answer honestly. We use this to seat people in pairs so nobody gets stuck alone.",
    },
  ],

  /**
   * Mahakumbh Hackathon — selected teams work with the Government of
   * Maharashtra on the Nashik Kumbh Mela (Aug–Sep 2027).
   *
   * One registration = one TEAM, not one person. The name/email/phone columns
   * on the registration are the team lead's — they're the single contact we
   * mail the ticket and every update to. Member 2 is captured here.
   *
   * `problem_statement` is the field the whole shortlisting runs off: three
   * teams are selected per statement, so admins sort the responses by it. Its
   * options come from `@/config/problem-statements`, the same array the event
   * page renders — a statement on the page but not in the dropdown is one
   * nobody can pick.
   *
   * Everyone here is from KJSIT, so there is no college question. Adding one
   * back would be twelve hundred people typing twelve spellings of "KJSIT"
   * into a field nothing reads.
   */
  "mahakumbh-hackathon": [
    {
      key: "team_name",
      label: "Team name",
      type: "text",
      required: true,
      placeholder: "e.g. Team Trimbak",
      hint: "This is what we'll call you throughout. Keep it clean — we'll rename anything we can't put on a slide.",
    },
    {
      key: "problem_statement",
      label: "Problem statement",
      type: "select",
      required: true,
      options: problemStatementOptions("mahakumbh-hackathon"),
      hint: "Three teams per statement. A statement closes the moment it has three, and we do not reassign teams — so pick the one you actually want to build for.",
      emphasiseHint: true,
    },
    {
      key: "problem_statement_pitch",
      label: "Your approach to that problem statement",
      type: "textarea",
      required: true,
      placeholder:
        "What you'd build, what data you'd need, and what the government would get at the end.",
      hint: "This is what the shortlisting is judged on. A few honest sentences beat a paragraph of buzzwords.",
    },

    // --- team lead (the person filling this in) ------------------------------
    {
      key: "lead_year",
      label: "Team lead — year of study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE"],
    },

    // --- member 2 ------------------------------------------------------------
    // Teams are exactly two. We collect the second member here rather than
    // asking them to register separately: a half-registered team is worse than
    // no team, and the pair has to be fixed before shortlisting anyway.
    {
      key: "member2_name",
      label: "Member 2 — full name",
      type: "text",
      required: true,
    },
    {
      key: "member2_email",
      label: "Member 2 — email",
      type: "email",
      required: true,
      hint: "Must be different from the team lead's. All official mail still goes to the lead.",
    },
    {
      key: "member2_phone",
      label: "Member 2 — phone",
      type: "phone",
      required: true,
    },
    {
      key: "member2_year",
      label: "Member 2 — year of study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE"],
    },

    // --- declaration ---------------------------------------------------------
    {
      key: "info_accurate",
      label: "Information is correct with best of our knowledge",
      type: "checkbox",
      required: true,
    },
  ],

  /**
   * Knowbuild 2.0 — 8-hour intra-college hackathon, 26 Sep 2026.
   *
   * One registration = one TEAM of 2-4, not one person. The name/email/phone
   * columns on the registration are the team leader's. `team_size` decides how
   * many of the member2/3/4 blocks below are actually required — member 2 is
   * always required (minimum team size is 2), member 3 and 4 are gated with
   * `showIf` so a two-person team never sees fields for people who don't exist.
   *
   * `track` similarly gates the new-idea vs existing-project questions: a
   * "New idea" team never sees the existing-repo link, an "Existing project"
   * team never sees the from-scratch problem statement. The idea proposal
   * document is required either way — see the hint on that field for what it
   * should contain.
   */
  "knowbuild-2-0": [
    // --- team & basic info -----------------------------------------------
    {
      key: "team_name",
      label: "Team name",
      type: "text",
      required: true,
      placeholder: "e.g. Team Ctrl+Z",
    },
    {
      key: "department",
      label: "Department",
      type: "select",
      required: true,
      options: ["AIDS", "COMPS", "IT", "EXTC"],
    },
    {
      key: "year",
      label: "Year of study",
      type: "radio",
      required: true,
      options: ["FY", "SY", "TY"],
    },
    {
      key: "team_size",
      label: "Team size",
      type: "radio",
      required: true,
      options: ["2", "3", "4"],
      hint: "Teams of 2 to 4. Fill in every teammate below — the fields adjust to match.",
    },

    // --- team leader (the person filling this in) -------------------------
    {
      key: "leader_github",
      label: "Team leader — GitHub",
      type: "text",
      required: false,
      placeholder: "https://github.com/...",
    },
    {
      key: "leader_linkedin",
      label: "Team leader — LinkedIn",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
    },

    // --- member 2 (every team has one) -------------------------------------
    { key: "member2_name", label: "Member 2 — full name", type: "text", required: true },
    { key: "member2_email", label: "Member 2 — email", type: "email", required: true },
    { key: "member2_phone", label: "Member 2 — phone", type: "phone", required: true },
    {
      key: "member2_github",
      label: "Member 2 — GitHub",
      type: "text",
      required: false,
      placeholder: "https://github.com/...",
    },
    {
      key: "member2_linkedin",
      label: "Member 2 — LinkedIn",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
    },

    // --- member 3 (teams of 3 or 4 only) -----------------------------------
    {
      key: "member3_name",
      label: "Member 3 — full name",
      type: "text",
      required: true,
      showIf: { key: "team_size", oneOf: ["3", "4"] },
    },
    {
      key: "member3_email",
      label: "Member 3 — email",
      type: "email",
      required: true,
      showIf: { key: "team_size", oneOf: ["3", "4"] },
    },
    {
      key: "member3_phone",
      label: "Member 3 — phone",
      type: "phone",
      required: true,
      showIf: { key: "team_size", oneOf: ["3", "4"] },
    },
    {
      key: "member3_github",
      label: "Member 3 — GitHub",
      type: "text",
      required: false,
      placeholder: "https://github.com/...",
      showIf: { key: "team_size", oneOf: ["3", "4"] },
    },
    {
      key: "member3_linkedin",
      label: "Member 3 — LinkedIn",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
      showIf: { key: "team_size", oneOf: ["3", "4"] },
    },

    // --- member 4 (teams of 4 only) -----------------------------------------
    {
      key: "member4_name",
      label: "Member 4 — full name",
      type: "text",
      required: true,
      showIf: { key: "team_size", oneOf: ["4"] },
    },
    {
      key: "member4_email",
      label: "Member 4 — email",
      type: "email",
      required: true,
      showIf: { key: "team_size", oneOf: ["4"] },
    },
    {
      key: "member4_phone",
      label: "Member 4 — phone",
      type: "phone",
      required: true,
      showIf: { key: "team_size", oneOf: ["4"] },
    },
    {
      key: "member4_github",
      label: "Member 4 — GitHub",
      type: "text",
      required: false,
      placeholder: "https://github.com/...",
      showIf: { key: "team_size", oneOf: ["4"] },
    },
    {
      key: "member4_linkedin",
      label: "Member 4 — LinkedIn",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
      showIf: { key: "team_size", oneOf: ["4"] },
    },

    // --- track --------------------------------------------------------------
    {
      key: "track",
      label: "Track",
      type: "radio",
      required: true,
      options: [
        "New idea (built from scratch in 8hrs)",
        "Existing project (adding features)",
      ],
      hint: "Bring a brand-new idea and build it from scratch, or take an existing project of yours and push it further with new features.",
      emphasiseHint: true,
    },

    // --- existing project only ------------------------------------------
    {
      key: "existing_project_link",
      label: "Link to the existing repo / demo",
      type: "text",
      required: true,
      placeholder: "GitHub link or Drive link",
      showIf: { key: "track", oneOf: ["Existing project (adding features)"] },
    },
    {
      key: "existing_project_baseline",
      label: "What exists + what you'll add (human language; no AI slop)",
      type: "textarea",
      required: true,
      placeholder: "So judges can tell the baseline apart from what you add in the 8 hours.",
      showIf: { key: "track", oneOf: ["Existing project (adding features)"] },
    },

    // --- new idea only ----------------------------------------------------
    {
      key: "problem_statement",
      label: "Problem statement",
      type: "text",
      required: true,
      placeholder: "What are you solving? Open theme — no fit check needed.",
      hint: "Make sure it's realistically buildable in 8 hours.",
      showIf: { key: "track", oneOf: ["New idea (built from scratch in 8hrs)"] },
    },
    {
      key: "solution_summary",
      label: "Solution — summarised (human language; no AI slop)",
      type: "textarea",
      required: true,
      placeholder: "What you're building and how it solves the problem above.",
      showIf: { key: "track", oneOf: ["New idea (built from scratch in 8hrs)"] },
    },

    // --- idea proposal document (both tracks) ------------------------------
    {
      key: "idea_proposal_document",
      label: "Idea proposal document",
      type: "file",
      required: true,
      accept: "application/pdf",
      hint:
        "PDF. Should cover: the problem/what you're solving, your proposed solution, planned scope for the 8hrs (new idea) or planned features to add (existing project), and your tech stack / tools.",
      link: {
        label: "Reference template",
        href: "https://docs.google.com/document/d/1Lxf5Xy2z00ODKDV75-3SpJp7Wf2nvOqk/edit?usp=sharing&ouid=114894815181906478862&rtpof=true&sd=true",
      },
      emphasiseHint: true,
    },

    // --- declaration ---------------------------------------------------------
    {
      key: "info_accurate",
      label: "Information is correct to the best of our knowledge",
      type: "checkbox",
      required: true,
    },

    // --- data processing consent (last, per organiser policy) --------------
    {
      key: "data_processing_consent",
      label: "Data Processing Consent",
      type: "checkbox",
      required: true,
      placeholder: "I have read and agree to the above.",
      hint:
        "By submitting this form, I consent to my team's submission details (including idea description, project links, and any resume/experience information shared) being processed using automated tools, including AI-based systems, for the purpose of evaluation and shortlisting. I understand that personally identifiable information will be handled with reasonable care, and that evaluation outcomes (score and feedback) will be shared only with my own team.",
      emphasiseHint: true,
    },
  ],

  /** Nothing beyond name/email/phone */
  minimal: [],
} as const satisfies Record<string, readonly FieldDef[]>;

export type FormKey = keyof typeof FORMS;

export const FORM_KEYS = Object.keys(FORMS) as FormKey[];

export function isFormKey(value: string): value is FormKey {
  return value in FORMS;
}

/**
 * Never index FORMS directly from a DB value — a stale `form_key` left behind
 * by a deploy would render an event page with no questions and silently accept
 * incomplete registrations. Fail loudly instead.
 */
export function getFormFields(formKey: string): FieldDef[] {
  if (!isFormKey(formKey)) {
    throw new Error(
      `Unknown form_key "${formKey}". Known keys: ${FORM_KEYS.join(", ")}. ` +
        `Either add it to src/config/forms/index.ts or fix the event.`,
    );
  }
  return FORMS[formKey] as unknown as FieldDef[];
}
