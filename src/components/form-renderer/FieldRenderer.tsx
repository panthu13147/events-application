"use client";

import type { FieldDef } from "@/lib/form-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Renders one question from the form registry.
 *
 * Values are held by the parent so the whole form is one controlled object
 * keyed by `field.key` — which is exactly the shape stored in
 * `registrations.answers`.
 */
export function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${field.key}`;
  const describedBy = [field.hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>

      {field.hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {field.hint}
        </p>
      ) : null}

      <FieldInput
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        describedBy={describedBy || undefined}
        invalid={Boolean(error)}
      />

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
  invalid: boolean;
}) {
  const common = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
  };

  switch (field.type) {
    case "select":
      return (
        <select
          {...common}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div role="radiogroup" aria-describedby={describedBy} className="space-y-2 pt-1">
          {field.options?.map((option) => {
            const checked = value === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                  checked ? "border-foreground/40 bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name={field.key}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  className="mt-0.5 size-4 shrink-0 accent-foreground"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );

    case "checkbox":
      return (
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-foreground"
          />
          <span>{field.placeholder ?? field.label}</span>
        </label>
      );

    case "textarea":
      return (
        <Textarea
          {...common}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    default:
      return (
        <Input
          {...common}
          type={field.type === "number" ? "number" : field.type === "phone" ? "tel" : field.type}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
