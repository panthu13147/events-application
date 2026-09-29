"use client";

import type { FieldDef, SlotAvailability } from "@/lib/form-types";
import {
  BrandInput,
  BrandLabel,
  BrandSelect,
  BrandTextarea,
  Req,
} from "@/components/s4ds";

/**
 * Renders one question from the form registry.
 *
 * Values are held by the parent so the whole form is one controlled object
 * keyed by `field.key` — which is exactly the shape stored in
 * `registrations.answers`.
 *
 * Styling comes from the S4DS brand primitives: this only ever renders inside
 * the public registration form, which sits on a bone panel.
 */
export function FieldRenderer({
  field,
  value,
  error,
  onChange,
  availability,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  /** Set only on the one field an event caps by answer. */
  availability?: SlotAvailability;
}) {
  const id = `field-${field.key}`;
  const describedBy = [field.hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  // Checkboxes carry their own label text, so a separate heading would say the
  // same thing twice.
  const standalone = field.type === "checkbox";

  return (
    <div>
      {standalone ? null : (
        <BrandLabel htmlFor={id}>
          {field.label}
          {field.required ? <Req /> : null}
        </BrandLabel>
      )}

      {field.hint ? (
        field.emphasiseHint ? (
          <div
            id={`${id}-hint`}
            className="mt-2 w-full rounded-[var(--s4ds-r-sm)] border-2 border-[var(--s4ds-edge)] bg-[color-mix(in_srgb,var(--s4ds-yellow)_30%,transparent)] px-3 py-2"
          >
            <p className="text-xs font-bold leading-relaxed">{field.hint}</p>
            {field.link ? (
              <a
                href={field.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-base font-black text-blue-600 underline underline-offset-4 hover:text-blue-800"
              >
                {field.link.label} ↗
              </a>
            ) : null}
          </div>
        ) : (
          <p
            id={`${id}-hint`}
            className="mt-1 max-w-[62ch] text-xs leading-relaxed text-[var(--s4ds-ink-invert-dim)]"
          >
            {field.hint}
          </p>
        )
      ) : null}

      <div className={standalone ? "" : "mt-2"}>
        <FieldInput
          id={id}
          field={field}
          value={value}
          onChange={onChange}
          describedBy={describedBy || undefined}
          invalid={Boolean(error)}
          availability={availability}
        />
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-sm font-bold text-[var(--s4ds-orange)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Selectable option row: a full black edge and a yellow fill when chosen. */
const OPTION_BASE =
  "flex cursor-pointer items-start gap-3 rounded-[var(--s4ds-r-sm)] border-2 px-3.5 py-3 text-sm transition-colors duration-150";

/** Same key, sized to sit inline. 44px tall keeps it a comfortable tap target. */
const OPTION_COMPACT =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--s4ds-r-sm)] border-2 px-3.5 py-2 text-sm transition-colors duration-150";

/**
 * How many places are left on one option, or null when the field isn't capped.
 *
 * Clamped at zero: a slot can legitimately go over its capacity if an admin
 * approves a rejected team back in, and "-1 left" helps nobody.
 */
function placesLeft(option: string, availability?: SlotAvailability): number | null {
  if (!availability) return null;
  return Math.max(0, availability.capacity - (availability.used[option] ?? 0));
}

function FieldInput({
  id,
  field,
  value,
  onChange,
  describedBy,
  invalid,
  availability,
}: {
  id: string;
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
  invalid: boolean;
  availability?: SlotAvailability;
}) {
  const common = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
  };

  switch (field.type) {
    case "select":
      return (
        <BrandSelect
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => {
            const left = placesLeft(option, availability);
            // A full option stays visible but unselectable. Removing it would
            // leave someone who was told about it hunting for an entry that
            // isn't there, with no explanation.
            return (
              <option key={option} value={option} disabled={left === 0}>
                {option}
                {left === null ? "" : left === 0 ? "  — FULL" : `  (${left} of ${availability!.capacity} left)`}
              </option>
            );
          })}
        </BrandSelect>
      );

    case "radio": {
      // Short option sets (COMPS / AI-DS / IT / EXTC, FY / SY / TY / LY) read
      // far better as a row of keys than a tall stack of near-empty rows.
      // Prose-length options keep the stack, where the text needs the width.
      const compact = (field.options ?? []).every((option) => option.length <= 14);

      return (
        <div
          role="radiogroup"
          aria-describedby={describedBy}
          aria-label={field.label}
          className={compact ? "flex flex-wrap gap-2" : "space-y-2"}
        >
          {field.options?.map((option) => {
            const checked = value === option;
            return (
              <label
                key={option}
                className={`${compact ? OPTION_COMPACT : OPTION_BASE} ${
                  checked
                    ? "border-[var(--s4ds-edge)] bg-[color-mix(in_srgb,var(--s4ds-yellow)_35%,transparent)] font-bold"
                    : "border-[var(--s4ds-ink-invert)]/25 hover:border-[var(--s4ds-edge)] hover:bg-[var(--s4ds-ink-invert)]/5"
                }`}
              >
                <input
                  type="radio"
                  name={field.key}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  className={`${compact ? "" : "mt-0.5"} size-4 shrink-0 accent-[var(--s4ds-orange)]`}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "checkbox":
      return (
        <label
          className={`${OPTION_BASE} ${
            value === true
              ? "border-[var(--s4ds-edge)] bg-[color-mix(in_srgb,var(--s4ds-yellow)_35%,transparent)] font-bold"
              : "border-[var(--s4ds-ink-invert)]/25 hover:border-[var(--s4ds-edge)] hover:bg-[var(--s4ds-ink-invert)]/5"
          }`}
        >
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--s4ds-orange)]"
          />
          <span>
            {field.placeholder ?? field.label}
            {field.required ? <Req /> : null}
          </span>
        </label>
      );

    case "textarea":
      return (
        <BrandTextarea
          {...common}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    default:
      return (
        <BrandInput
          {...common}
          type={field.type === "number" ? "number" : field.type === "phone" ? "tel" : field.type}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
