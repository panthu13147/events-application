"use client";

import { useRouter } from "next/navigation";

export function EventSelector({
  events,
  selectedSlug,
}: {
  events: { id: string; slug: string; title: string }[];
  selectedSlug?: string;
}) {
  const router = useRouter();

  return (
    <select
      id="event-select"
      className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      defaultValue={selectedSlug ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          router.push(`/admin/cert?event=${val}`);
        } else {
          router.push(`/admin/cert`);
        }
      }}
    >
      <option value="" disabled>
        -- Select an event --
      </option>
      {events?.map((evt) => (
        <option key={evt.id} value={evt.slug}>
          {evt.title}
        </option>
      ))}
    </select>
  );
}
