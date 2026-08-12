import { z } from "zod";

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea";

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
};

/**
 * Builds the Zod schema for an event's extra questions from the same array the
 * renderer uses, so the form and the API can never disagree about what's valid.
 */
export function buildAnswersSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const required = field.required ?? false;
    let schema: z.ZodTypeAny;

    switch (field.type) {
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

  return z.object(shape);
}
