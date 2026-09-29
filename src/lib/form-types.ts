import { z } from "zod";

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea"
  | "file";

export type FieldDef = {
  /** Key in Registration.answers. Stable — renaming it orphans existing data. */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** Help text under the input */
  hint?: string;
  /**
   * Renders the hint as a callout rather than quiet grey text. For the one or
   * two hints per form that change what someone should answer — not a way to
   * make every hint louder, which just resets the baseline.
   */
  emphasiseHint?: boolean;
  /** Required for select / radio */
  options?: string[];
  /** `<input accept>` for type "file". Defaults to PDF. */
  accept?: string;
  /**
   * A prominent, clickable link rendered under the hint — for pointing at a
   * reference doc or template. Kept apart from `hint` (plain text) rather than
   * inlining a raw URL in the sentence, which reads worse and isn't tappable.
   */
  link?: { label: string; href: string };
  /**
   * Only render (and only require) this field when another field's answer is
   * one of these values. Used for track-dependent questions — an "existing
   * project" question that shows up regardless of track would just confuse
   * whoever picked "new idea".
   *
   * Deliberately narrow: exact-match-on-one-other-field is what every
   * conditional field in these forms has needed so far. Reach for something
   * richer only once a form actually needs it.
   */
  showIf?: { key: string; oneOf: string[] };
};

/** Whether `field` should be shown/required, given the answers so far. */
export function isFieldActive(field: FieldDef, answers: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const guard = answers[field.showIf.key];
  return typeof guard === "string" && field.showIf.oneOf.includes(guard);
}

/**
 * Per-option availability for the one field an event caps by answer.
 *
 * Only ever advisory. The database decides whether a place exists
 * (register_for_event, supabase/migrations/0008_slot_capacity.sql) — this
 * exists so someone can see what's left before typing everything out, rather
 * than being told after they submit.
 */
export type SlotAvailability = {
  /** `FieldDef.key` of the capped question. */
  fieldKey: string;
  /** Places per option. */
  capacity: number;
  /** Places already held, keyed by the exact option string. Absent = zero. */
  used: Record<string, number>;
};

/**
 * Builds the Zod schema for an event's extra questions from the same array the
 * renderer uses, so the form and the API can never disagree about what's valid.
 */
export function buildAnswersSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // A conditional field can't be required at the shape level — Zod has no
    // way to see a sibling answer there. Required-when-active is enforced
    // below instead, once the whole object is available.
    const required = (field.required ?? false) && !field.showIf;
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case "file":
        schema = required
          ? z.string().trim().min(1, `${field.label} is required`).max(300)
          : z.string().trim().max(300);
        break;

      case "email":
        schema = z.email({ message: "Enter a valid email address" });
        break;

      case "phone":
        schema = z
          .string()
          .trim()
          .regex(/^[+\d][\d\s-]{7,17}$/, "Enter a valid phone number");
        break;

      case "number":
        schema = z.coerce.number({ message: `${field.label} must be a number` });
        break;

      case "select":
      case "radio":
        if (!field.options?.length) {
          // A select with no options can only ever reject every submission.
          // Fail loudly at import time rather than silently blocking signups.
          throw new Error(
            `Form field "${field.key}" is a ${field.type} but has no options`,
          );
        }
        schema = z.enum(field.options as [string, ...string[]]);
        break;

      case "checkbox":
        // A required checkbox means "must be ticked" (consent, code of conduct).
        schema = required
          ? z.literal(true, { message: `${field.label} is required` })
          : z.boolean();
        break;

      case "textarea":
      case "text":
      default: {
        const base = z.string().trim().max(500);
        schema = required ? base.min(1, `${field.label} is required`) : base;
        break;
      }
    }

    shape[field.key] = required ? schema : schema.optional();
  }

  const object = z.object(shape);

  // Conditional fields (member 3/4, track-specific questions) are optional at
  // the shape level above — a sibling answer decides whether they're actually
  // required, which only this second pass can see.
  const conditional = fields.filter((field) => field.required && field.showIf);
  if (conditional.length === 0) return object;

  return object.superRefine((data, ctx) => {
    for (const field of conditional) {
      if (!isFieldActive(field, data)) continue;
      const value = data[field.key];
      const empty =
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && value.trim() === "");
      if (empty) {
        ctx.addIssue({ code: "custom", message: `${field.label} is required`, path: [field.key] });
      }
    }
  });
}
