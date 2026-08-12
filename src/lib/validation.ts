import { z } from "zod";
import { FORM_KEYS } from "@/config/forms";
import { isReservedSlug } from "@/lib/reserved-slugs";

/**
 * One Zod schema per API body in the contract (docs/ARCHITECTURE.md).
 *
 * Shared by the client form and the route handler so they can never disagree
 * about what's valid. If you change a shape here, say so in the group — it's
 * a contract change, not a local edit.
 */

// --- shared pieces ----------------------------------------------------------

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only")
  .refine((slug) => !isReservedSlug(slug), {
    message:
      "That slug is reserved by the site (it would shadow a real page). Pick another.",
  });

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{7,17}$/, "Enter a valid phone number");

// --- admin auth -------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// --- events -----------------------------------------------------------------

const eventFields = z
  .object({
    slug: slugSchema,
    title: z.string().trim().min(3).max(120),
    tagline: z.string().trim().max(200).optional(),
    description: z.string().max(10_000).optional(),
    venue: z.string().trim().max(200).optional(),
    banner_url: z.url().optional(),
    form_key: z.enum(FORM_KEYS as [string, ...string[]]),

    starts_at: z.coerce.date(),
    ends_at: z.coerce.date(),
    capacity: z.number().int().positive().nullable().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).default("DRAFT"),

    registration_opens_at: z.coerce.date().nullable().optional(),
    registration_closes_at: z.coerce.date().nullable().optional(),

    requires_payment: z.boolean().default(false),
    /** Paise. 250 rupees = 25000. */
    fee_amount: z.number().int().nonnegative().nullable().optional(),
    payment_qr_url: z.url().nullable().optional(),
    auto_approve: z.boolean().default(true),

    certificate_enabled: z.boolean().default(false),
    certificate_template_url: z.url().nullable().optional(),

    days: z
      .array(
        z.object({
          day_number: z.number().int().positive(),
          label: z.string().trim().max(120).optional(),
          date: z.coerce.date(),
        }),
      )
      .min(1, "An event needs at least one day"),
  });

export const eventInputSchema = eventFields
  .refine((data) => data.ends_at >= data.starts_at, {
    message: "End date must be on or after the start date",
    path: ["ends_at"],
  })
  .refine(
    (data) => !data.requires_payment || (data.fee_amount != null && data.fee_amount > 0),
    { message: "A paid event needs a fee amount", path: ["fee_amount"] },
  )
  .refine(
    (data) => !data.requires_payment || Boolean(data.payment_qr_url),
    { message: "A paid event needs a UPI QR image", path: ["payment_qr_url"] },
  )
  .refine(
    (data) =>
      new Set(data.days.map((d) => d.day_number)).size === data.days.length,
    { message: "Day numbers must be unique", path: ["days"] },
  );

/**
 * PATCH sends only the changed fields, so the cross-field refinements above
 * can't run (they'd read undefined). Re-check those invariants in the route
 * handler against the merged event, not here.
 */
export const eventUpdateSchema = eventFields.partial();

// --- registration -----------------------------------------------------------

/**
 * The fixed part of a registration. The event's extra questions are validated
 * separately with buildAnswersSchema(getFormFields(event.form_key)) — the API
 * must run BOTH, or a student could submit an incomplete registration.
 */
export const registrationBaseSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email address").toLowerCase(),
  phone: phoneSchema.optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  payment_proof_url: z.url().optional(),
});

export const ticketRetrieveSchema = z.object({
  email: z.email().toLowerCase(),
  event_slug: slugSchema,
});

export const registrationStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLISTED", "CANCELLED"]),
  /** Optional note included in the rejection email */
  reason: z.string().trim().max(500).optional(),
});

// --- scanning ---------------------------------------------------------------

export const scanSchema = z.object({
  qr_token: z.string().min(20, "Not a valid ticket QR"),
  event_day_id: z.string().min(1),
});

// --- types ------------------------------------------------------------------

export type LoginInput = z.infer<typeof loginSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type RegistrationBaseInput = z.infer<typeof registrationBaseSchema>;
export type ScanInput = z.infer<typeof scanSchema>;
