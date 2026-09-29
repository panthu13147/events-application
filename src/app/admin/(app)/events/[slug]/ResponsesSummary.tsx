"use client";

import { useState } from "react";
import { ChartPie } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FieldSummary, Slice } from "@/lib/responses-summary";

/**
 * The Google-Forms "Responses" view: one card per question, a pie when the
 * answers come from a short fixed list and a bar when they don't.
 *
 * Every value is printed next to its mark, so nothing is hidden behind a hover
 * and nothing rests on colour alone — which is also what makes the lighter
 * slice colours legal on the white card.
 */

/** Matches --viz-1..5 in globals.css. See the note there before reordering. */
const SLICE_COLORS = [
  "var(--viz-1)",
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
];

function colorFor(index: number) {
  return SLICE_COLORS[index] ?? "var(--viz-other)";
}

function percent(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

export function ResponsesSummary({
  fields,
  perDay,
  total,
  scope,
}: {
  fields: FieldSummary[];
  /** Sign-ups per day, oldest first. Shown even when the form asks nothing extra. */
  perDay: Slice[];
  /** Registrations in the selected status tab — the denominator for everything here. */
  total: number;
  /** Label of the selected status tab, so the numbers say what they are counting. */
  scope: string;
}) {
  const [open, setOpen] = useState(false);
  const everyone = scope === "All";

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="gap-2"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChartPie className="size-4" />
        {open ? "Hide summary" : "Summary"}
        <span className="tabular-nums opacity-60">{total}</span>
        {everyone ? null : (
          <span className="text-muted-foreground">· {scope.toLowerCase()}</span>
        )}
      </Button>

      {open ? (
        total === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {everyone
              ? "No registrations yet, so there is nothing to summarise."
              : `No registrations in ${scope.toLowerCase()}, so there is nothing to summarise.`}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <p className="text-sm text-muted-foreground lg:col-span-2">
              Counting the{" "}
              <span className="font-medium text-foreground">
                {total} {everyone ? "registration" : scope.toLowerCase()}
                {everyone && total !== 1 ? "s" : ""}
              </span>{" "}
              in this tab. Switch tabs above to summarise a different set.
            </p>

            <Card title="Sign-ups per day" subtitle={`${total} in total`}>
              <BarChart slices={perDay} total={total} />
            </Card>

            {fields.map((field) => (
              <Card
                key={field.key}
                title={field.label}
                subtitle={
                  field.blank > 0
                    ? `${field.answered} answered · ${field.blank} left blank`
                    : `${field.answered} answered`
                }
              >
                {field.slices.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nobody answered this one.
                  </p>
                ) : field.chart === "pie" ? (
                  <PieChart slices={field.slices} total={field.answered} label={field.label} />
                ) : (
                  <BarChart slices={field.slices} total={field.answered} />
                )}
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const RADIUS = 58;
const THICKNESS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Arc-length of the gap between slices — the ring's own version of a 2px spacer. */
const GAP = 3;

/**
 * Walks the ring once, so each slice knows where the one before it ended. A
 * single answer would otherwise render as a full circle with a gap cut into it
 * for no reason, so the one-slice case drops the spacer.
 */
function toArcs(slices: Slice[], total: number) {
  const gap = slices.length > 1 ? GAP : 0;

  return slices.map((slice, index) => {
    const before = slices.slice(0, index).reduce((sum, earlier) => sum + earlier.count, 0);
    const span = (slice.count / total) * CIRCUMFERENCE;

    return {
      slice,
      start: (before / total) * CIRCUMFERENCE,
      length: Math.max(span - gap, 1),
    };
  });
}

function PieChart({
  slices,
  total,
  label,
}: {
  slices: Slice[];
  total: number;
  label: string;
}) {
  const arcs = toArcs(slices, total);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <svg
        viewBox="0 0 160 160"
        className="size-[160px] shrink-0"
        role="img"
        aria-label={`${label}: ${slices
          .map((slice) => `${slice.label} ${percent(slice.count, total)}%`)
          .join(", ")}`}
      >
        <g transform="rotate(-90 80 80)">
          {arcs.map(({ slice, start, length }, index) => (
            <circle
              key={slice.label}
              cx={80}
              cy={80}
              r={RADIUS}
              fill="none"
              stroke={colorFor(index)}
              strokeWidth={THICKNESS}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-start}
            >
              <title>{`${slice.label}: ${slice.count} (${percent(slice.count, total)}%)`}</title>
            </circle>
          ))}
        </g>
        <text
          x={80}
          y={80}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-xl font-semibold"
        >
          {total}
        </text>
      </svg>

      <Legend slices={slices} total={total} />
    </div>
  );
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <ul className="min-w-[140px] flex-1 space-y-1.5 text-sm">
      {slices.map((slice, index) => (
        <li key={slice.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: colorFor(index) }}
          />
          <span className="min-w-0 flex-1 truncate" title={slice.label}>
            {slice.label}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {slice.count} · {percent(slice.count, total)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Horizontal bars, because the labels are answers people typed and they do not
 * fit under a vertical axis. One colour throughout: each bar already carries its
 * own label, so length is the only thing left to compare and a second hue would
 * just be decoration.
 */
function BarChart({ slices, total }: { slices: Slice[]; total: number }) {
  // Bars are scaled against the biggest answer, not the total — otherwise a
  // spread-out question renders as a row of slivers.
  const peak = Math.max(...slices.map((slice) => slice.count), 1);

  return (
    <ul className="space-y-2.5">
      {slices.map((slice) => (
        <li key={slice.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm" title={slice.label}>
            {slice.label}
          </span>
          <span className="h-5 rounded-[3px] bg-muted">
            <span
              className="block h-full rounded-r-[4px]"
              style={{
                width: `${Math.max((slice.count / peak) * 100, 2)}%`,
                background: "var(--viz-1)",
              }}
              title={`${slice.label}: ${slice.count} (${percent(slice.count, total)}%)`}
            />
          </span>
          <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
            {slice.count} · {percent(slice.count, total)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
