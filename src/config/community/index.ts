/**
 * The group people are asked to join after registering, keyed by `Event.slug`.
 *
 * Same reasoning as the form, speaker and problem-statement registries: content
 * that changes once per event, easier to review in a diff than in a table.
 *
 * This is where day-of updates actually reach people. Email gets read once;
 * "the hall moved to 402" needs a channel people already have open, and we
 * can't send SMS. So the ask goes on the ticket page AND in the confirmation
 * email rather than in one of the two.
 *
 * A WhatsApp invite link is a **capability**: anyone holding it can join the
 * group. It's on the ticket page, which is only reachable with a registration
 * code, and in the registrant's own email — but treat it as semi-public and
 * reset the link from WhatsApp if it spreads further than you want.
 */

export type CommunityGroup = {
  /** Invite URL. */
  url: string;
  /** What they're joining, in the button. */
  label: string;
  /** One line on why it's worth joining — this is the part that persuades. */
  reason: string;
};

export const COMMUNITY_GROUPS: Record<string, CommunityGroup> = {
  "mahakumbh-hackathon": {
    // The invite code is the whole link. The `?s=cl&p=a&ilr=1` on the copied
    // URL is share-source analytics from wherever it was copied, not part of
    // the invite — dropped so the link stays readable. Add them back if a join
    // ever fails, but it won't.
    url: "https://chat.whatsapp.com/BDDXiRWSjhgIfbgql4MQRG",
    label: "Join the WhatsApp group",
    reason:
      "Problem statement briefs, shortlist announcements and day-of updates go there first.",
  },
  "knowbuild-2-0": {
    url: "https://chat.whatsapp.com/LH64EyxMJgj8sVk9XxgbUA",
    label: "Join the WhatsApp group",
    reason: "Review results, track/venue updates and day-of instructions go there first.",
  },
};

/**
 * Unlike `getFormFields`, an unknown slug is not an error: most events have no
 * group and the whole block is omitted.
 */
export function getCommunityGroup(slug: string): CommunityGroup | null {
  return COMMUNITY_GROUPS[slug] ?? null;
}
