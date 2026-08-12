"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { FieldDef } from "@/lib/form-types";
import { FieldRenderer } from "@/components/form-renderer/FieldRenderer";
import {
  BrandButton,
  BrandInput,
  BrandLabel,
  Req,
} from "@/components/s4ds";

type Props = {
  slug: string;
  fields: FieldDef[];
  requiresPayment: boolean;
  feeLabel: string;
  /** Conditions for getting the deposit back. Null when nothing is charged. */
  refundTerms: string | null;
  paymentQrUrl: string | null;
  /**
   * Event is full — this signs the person up for the waitlist. `requiresPayment`
   * is already false in this case, so there is no payment step to run.
   */
  waitlisting?: boolean;
};

type Answers = Record<string, unknown>;

/** Nearly everyone registering is in India; the field stays editable for the rest. */
const DEFAULT_DIAL_CODE = "+91";

/** Indian mobile numbers are 10 digits and never start below 6. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Inline field error. Orange on bone is 4.6:1, and the copy leads with what to do. */
function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-sm font-bold text-[var(--s4ds-orange)]"
    >
      {children}
    </p>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-orange)] bg-[color-mix(in_srgb,var(--s4ds-orange)_14%,transparent)] px-4 py-3 text-sm font-bold text-[var(--s4ds-ink-invert)]"
    >
      {children}
    </p>
  );
}

/** Two dots and a rule — enough to say "there's one more screen" without a wizard. */
function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.08em]">
      {([1, 2] as const).map((step) => {
        const label = step === 1 ? "Your details" : "Payment";
        const done = current > step;
        const active = current === step;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`grid size-6 place-items-center rounded-full border-2 border-[var(--s4ds-edge)] tabular-nums ${
                active || done
                  ? "bg-[var(--s4ds-yellow)] text-[var(--s4ds-void)]"
                  : "bg-transparent text-[var(--s4ds-ink-invert-dim)]"
              }`}
            >
              {done ? "✓" : step}
            </span>
            <span
              className={
                active
                  ? "text-[var(--s4ds-ink-invert)]"
                  : "text-[var(--s4ds-ink-invert-dim)]"
              }
              aria-current={active ? "step" : undefined}
            >
              {label}
            </span>
            {step === 1 ? (
              <span aria-hidden className="h-[2px] w-5 bg-[var(--s4ds-ink-invert)]/25" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Two steps: details, then payment.
 *
 * Splitting them keeps the first screen short enough to not feel like a form,
 * and means nobody opens their UPI app until they've committed to registering.
 */
export function RegistrationForm({
  slug,
  fields,
  requiresPayment,
  feeLabel,
  refundTerms,
  paymentQrUrl,
  waitlisting = false,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState<"details" | "payment">("details");
  const [contact, setContact] = useState({ full_name: "", email: "" });
  // Country code and subscriber number are held apart so the field can't be
  // filled with "9876543210" and silently mean nothing, or with a second
  // country code pasted in front of the first.
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function validateDetails() {
    const next: Record<string, string> = {};

    if (contact.full_name.trim().length < 2) next.full_name = "Enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) next.email = "Enter a valid email address";

    if (!/^\+\d{1,4}$/.test(dialCode)) {
      next.phone = "Enter a country code, like +91";
    } else if (dialCode === DEFAULT_DIAL_CODE) {
      if (!INDIAN_MOBILE.test(phoneNumber)) {
        next.phone = "Enter a 10-digit mobile number, without the country code";
      }
    } else if (!/^\d{6,14}$/.test(phoneNumber)) {
      next.phone = "Enter the number without the country code";
    }

    for (const field of fields) {
      if (!field.required) continue;
      const value = answers[field.key];
      if (value === undefined || value === "" || value === null) {
        next[field.key] = `${field.label} is required`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onContinue(event: React.FormEvent) {
    event.preventDefault();
    if (!validateDetails()) return;
    setFormError(null);
    if (requiresPayment) {
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void submit();
    }
  }

  async function submit() {
    setPending(true);
    setFormError(null);

    try {
      let payment_proof_url: string | undefined;

      if (requiresPayment) {
        if (!proof) {
          setFormError("Upload a screenshot of your payment to continue.");
          setPending(false);
          return;
        }
        payment_proof_url = await uploadProof(proof, slug);
      }

      const response = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The two phone inputs are joined back into the single `phone` column
        // the API and the email worker expect.
        body: JSON.stringify({
          ...contact,
          phone: `${dialCode} ${phoneNumber}`,
          answers,
          payment_proof_url,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(body.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }

      router.push(`/t/${body.code}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
      setPending(false);
    }
  }

  if (step === "payment") {
    return (
      <div>
        <Steps current={2} />

        <h3 className="text-2xl font-black tracking-[-0.02em]">Pay {feeLabel} to confirm</h3>
        <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-[var(--s4ds-ink-invert-dim)] text-pretty">
          This is a{" "}
          <strong className="font-bold text-[var(--s4ds-ink-invert)]">
            refundable deposit
          </strong>
          , not a fee.{" "}
          {refundTerms ?? "You get it back when you attend."} It only exists so seats
          don&apos;t go to no-shows.
        </p>

        {paymentQrUrl ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-[var(--s4ds-r)] border-[3px] border-[var(--s4ds-edge)] bg-[var(--s4ds-paper)] p-6">
            <Image
              src={paymentQrUrl}
              alt="UPI QR code for payment"
              width={200}
              height={200}
              className="size-48 object-contain"
              unoptimized
            />
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--s4ds-ink-invert-dim)]">
              Scan with any UPI app
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-[var(--s4ds-r-sm)] border-2 border-dashed border-[var(--s4ds-ink-invert)]/35 p-4 text-sm font-bold text-[var(--s4ds-ink-invert-dim)]">
            Payment QR not uploaded yet. Ask the organisers.
          </p>
        )}

        <div className="mt-6">
          <BrandLabel htmlFor="proof">
            Upload payment screenshot
            <Req />
          </BrandLabel>
          <p className="mt-1 mb-2 text-xs text-[var(--s4ds-ink-invert-dim)]">
            JPG, PNG or WebP. Large photos are compressed automatically.
          </p>
          <BrandInput
            id="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
            className="h-auto py-2.5 file:mr-3 file:rounded-[var(--s4ds-r-sm)] file:border-2 file:border-[var(--s4ds-edge)] file:bg-[var(--s4ds-yellow)] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:tracking-[0.04em] file:text-[var(--s4ds-void)]"
          />
        </div>

        {formError ? (
          <div className="mt-5">
            <FormError>{formError}</FormError>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <BrandButton
            variant="bone"
            onClick={() => setStep("details")}
            disabled={pending}
            className="border-[var(--s4ds-edge)]"
          >
            Back
          </BrandButton>
          <BrandButton
            variant="accent"
            className="flex-1"
            onClick={() => void submit()}
            disabled={pending}
          >
            {pending ? "Submitting…" : "Complete registration"}
          </BrandButton>
        </div>

        <p className="mt-5 max-w-[60ch] text-xs leading-relaxed text-[var(--s4ds-ink-invert-dim)]">
          Your spot is held while an organiser checks the payment. You&apos;ll get a
          confirmation email with your ticket once it&apos;s approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onContinue} noValidate>
      {requiresPayment ? <Steps current={1} /> : null}

      <div className="space-y-5">
        <div>
          <BrandLabel htmlFor="full_name">
            Full name
            <Req />
          </BrandLabel>
          <BrandInput
            id="full_name"
            className="mt-2"
            value={contact.full_name}
            onChange={(event) => setContact({ ...contact, full_name: event.target.value })}
            aria-invalid={Boolean(errors.full_name) || undefined}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            autoComplete="name"
            placeholder="Your Name"
          />
          {errors.full_name ? (
            <FieldError id="full_name-error">{errors.full_name}</FieldError>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <BrandLabel htmlFor="email">
              Email
              <Req />
            </BrandLabel>
            <BrandInput
              id="email"
              type="email"
              className="mt-2"
              value={contact.email}
              onChange={(event) => setContact({ ...contact, email: event.target.value })}
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              autoComplete="email"
              placeholder="you@somaiya.edu"
            />
            {errors.email ? <FieldError id="email-error">{errors.email}</FieldError> : null}
          </div>

          <div>
            <BrandLabel htmlFor="phone">
              WhatsApp number
              <Req />
            </BrandLabel>
            <div className="mt-2 flex gap-2">
              <BrandInput
                id="dial_code"
                type="tel"
                inputMode="tel"
                className="w-20 shrink-0 text-center font-bold tabular-nums"
                value={dialCode}
                onChange={(event) => setDialCode(event.target.value.trim())}
                aria-label="Country code"
                aria-invalid={Boolean(errors.phone) || undefined}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                autoComplete="tel-country-code"
                maxLength={5}
              />
              <BrandInput
                id="phone"
                type="tel"
                inputMode="numeric"
                className="tabular-nums"
                value={phoneNumber}
                // Strip anything that isn't a digit as it's typed, so a pasted
                // "+91 98765 43210" or "098765-43210" lands as a clean number
                // instead of a validation error the person has to decode.
                onChange={(event) =>
                  setPhoneNumber(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, dialCode === DEFAULT_DIAL_CODE ? 10 : 14),
                  )
                }
                aria-invalid={Boolean(errors.phone) || undefined}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                autoComplete="tel-national"
                placeholder="9876543210"
              />
            </div>
            {errors.phone ? <FieldError id="phone-error">{errors.phone}</FieldError> : null}
          </div>
        </div>

        {fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={answers[field.key]}
            error={errors[field.key]}
            onChange={(value) => setAnswers({ ...answers, [field.key]: value })}
          />
        ))}

        {formError ? <FormError>{formError}</FormError> : null}

        <BrandButton type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
          {requiresPayment
            ? `Continue to payment · ${feeLabel}`
            : pending
              ? "Submitting…"
              : waitlisting
                ? "Join the waitlist"
                : "Register"}
        </BrandButton>
      </div>
    </form>
  );
}

/**
 * Resize before upload. Phone photos are 3–5MB, which is slow on venue wifi
 * and larger than the storage bucket's limit for no benefit — a payment
 * screenshot is legible at 1200px.
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.82);
  });
}

async function uploadProof(file: File, slug: string): Promise<string> {
  const compressed = await compress(file).catch(() => file);

  const body = new FormData();
  body.append("file", compressed, "proof.jpg");
  body.append("slug", slug);

  const response = await fetch("/api/upload", { method: "POST", body });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(json.error ?? "Upload failed");
  return json.url as string;
}
