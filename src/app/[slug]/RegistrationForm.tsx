"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { FieldDef } from "@/lib/form-types";
import { FieldRenderer } from "@/components/form-renderer/FieldRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  slug: string;
  fields: FieldDef[];
  requiresPayment: boolean;
  feeLabel: string;
  paymentQrUrl: string | null;
};

type Answers = Record<string, unknown>;

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
  paymentQrUrl,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState<"details" | "payment">("details");
  const [contact, setContact] = useState({ full_name: "", email: "", phone: "" });
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function validateDetails() {
    const next: Record<string, string> = {};

    if (contact.full_name.trim().length < 2) next.full_name = "Enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) next.email = "Enter a valid email address";
    if (!/^[+\d][\d\s-]{7,17}$/.test(contact.phone)) next.phone = "Enter a valid phone number";

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
        body: JSON.stringify({ ...contact, answers, payment_proof_url }),
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
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pay {feeLabel} to confirm</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a <strong className="font-medium text-foreground">refundable deposit</strong> —
            you get it back when you attend. It only exists so seats don&apos;t go to no-shows.
          </p>
        </div>

        {paymentQrUrl ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6">
            <Image
              src={paymentQrUrl}
              alt="UPI QR code for payment"
              width={200}
              height={200}
              className="size-48 rounded-lg object-contain"
              unoptimized
            />
            <p className="text-xs text-muted-foreground">Scan with any UPI app</p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Payment QR not uploaded yet — ask the organisers.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="proof">
            Upload payment screenshot<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            id="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG or WebP. Large photos are compressed automatically.
          </p>
        </div>

        {formError ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("details")}
            disabled={pending}
          >
            Back
          </Button>
          <Button type="button" className="flex-1" onClick={() => void submit()} disabled={pending}>
            {pending ? "Submitting…" : "Complete registration"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Your spot is held while an organiser checks the payment. You&apos;ll get a confirmation
          email with your ticket once it&apos;s approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onContinue} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="full_name">
          Full Name<span className="ml-0.5 text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          value={contact.full_name}
          onChange={(event) => setContact({ ...contact, full_name: event.target.value })}
          aria-invalid={Boolean(errors.full_name) || undefined}
          placeholder="Riddhesh Kulkarni"
        />
        {errors.full_name ? <p className="text-xs text-destructive">{errors.full_name}</p> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">
            Email<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={contact.email}
            onChange={(event) => setContact({ ...contact, email: event.target.value })}
            aria-invalid={Boolean(errors.email) || undefined}
            placeholder="you@somaiya.edu"
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            WhatsApp Number<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={contact.phone}
            onChange={(event) => setContact({ ...contact, phone: event.target.value })}
            aria-invalid={Boolean(errors.phone) || undefined}
            placeholder="+91 90000 00000"
          />
          {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
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

      {formError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {requiresPayment ? `Continue to payment · ${feeLabel}` : pending ? "Submitting…" : "Register"}
      </Button>
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
