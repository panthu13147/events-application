import type { FieldDef } from "@/lib/form-types";

/**
 * Turns raw `registrations.answers` into the shape the summary charts render.
 *
 * This runs on the server over the registrations in the selected status tab, so
 * "what did people answer" can be asked of the approved crowd, the ones still
 * needing review, or everyone. The caller decides the slice; the label on screen
 * names it, so the numbers never look like they cover more than they do.
 */

export type Slice = { label: string; count: number };

export type FieldSummary = {
  key: string;
  label: string;
  /** Pie reads share-of-whole; bar reads magnitude once there are too many slices. */
  chart: "pie" | "bar";
  slices: Slice[];
  /** How many people answered at all — the denominator for every percentage. */
  answered: number;
  /** Left blank. Shown as a footnote rather than a slice, so shares stay honest. */
  blank: number;
};

/**
 * Above this a pie stops being readable — slices get too thin to compare and
 * the ring runs out of validated adjacent colours. Long option lists go to a
 * bar chart, where position does the work and one colour is enough.
 */
const MAX_PIE_SLICES = 5;

/** Free-text answers have no fixed option list, so only the head is worth a bar. */
const MAX_TEXT_BARS = 8;

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
}

/**
 * Counts a field whose answers come from a fixed list. Options keep their
 * declared order — the order in `src/config/forms` is the order on the chart,
 * so "FE, SE, TE, BE" never arrives shuffled by popularity.
 */
function fromOptions(field: FieldDef, values: string[]): Slice[] {
  const counts = new Map<string, number>();
  for (const option of field.options ?? []) counts.set(option, 0);

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  // Options nobody picked are dropped rather than drawn as a zero-width slice.
  return [...counts].filter(([, count]) => count > 0).map(([label, count]) => ({ label, count }));
}

/**
 * Counts free text by exact answer, case-folded so "KJSIT" and "kjsit" are one
 * college. The long tail collapses into a single row — a bar chart with sixty
 * one-vote rows answers nothing.
 */
function fromText(values: string[]): Slice[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const value of values) {
    const key = value.toLowerCase();
    const seen = counts.get(key);
    if (seen) seen.count += 1;
    else counts.set(key, { label: value, count: 1 });
  }

  const ranked = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  if (ranked.length <= MAX_TEXT_BARS) return ranked;

  const head = ranked.slice(0, MAX_TEXT_BARS);
  const tail = ranked.slice(MAX_TEXT_BARS);
  const rest = tail.reduce((sum, row) => sum + row.count, 0);

  return [...head, { label: `${tail.length} other answers`, count: rest }];
}

export function summariseAnswers(
  fields: FieldDef[],
  rows: { answers: Record<string, unknown> }[],
): FieldSummary[] {
  return fields.map((field) => {
    const values = rows.map((row) => asText(row.answers?.[field.key])).filter(Boolean);
    const fixed = field.type === "select" || field.type === "radio" || field.type === "checkbox";

    const slices = fixed ? fromOptions(field, values) : fromText(values);

    return {
      key: field.key,
      label: field.label,
      chart: fixed && slices.length <= MAX_PIE_SLICES ? "pie" : "bar",
      slices,
      answered: values.length,
      blank: rows.length - values.length,
    };
  });
}
