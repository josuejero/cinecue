export const PUSH_EVENT_KINDS = [
  "newly_scheduled",
  "now_playing",
  "advance_tickets",
  "theatre_count_increased",
  "final_showing_soon",
] as const;

export type PushEventKind = (typeof PUSH_EVENT_KINDS)[number];

export type PushPreferenceSubset = {
  pushEnabled: boolean;
  newlyScheduledEnabled: boolean;
  nowPlayingEnabled: boolean;
  advanceTicketsEnabled: boolean;
  theatreCountIncreasedEnabled: boolean;
  finalShowingSoonEnabled: boolean;
};

export type PushSkipReason =
  | "preferences_disabled"
  | "follow_created_after_event"
  | "subscription_created_after_event";

export function shouldSendPushForEventKind(
  preferences: PushPreferenceSubset,
  eventKind: string,
) {
  if (!preferences.pushEnabled) {
    return false;
  }

  switch (eventKind) {
    case "newly_scheduled":
      return preferences.newlyScheduledEnabled;
    case "now_playing":
      return preferences.nowPlayingEnabled;
    case "advance_tickets":
      return preferences.advanceTicketsEnabled;
    case "theatre_count_increased":
      return preferences.theatreCountIncreasedEnabled;
    case "final_showing_soon":
      return preferences.finalShowingSoonEnabled;
    default:
      return false;
  }
}

export function getPushSkipReason(input: {
  preferences: PushPreferenceSubset;
  eventKind: string;
  changedAt: Date;
  followCreatedAt: Date;
  subscriptionCreatedAt: Date;
}): PushSkipReason | null {
  if (!shouldSendPushForEventKind(input.preferences, input.eventKind)) {
    return "preferences_disabled";
  }

  if (input.followCreatedAt.getTime() > input.changedAt.getTime()) {
    return "follow_created_after_event";
  }

  if (input.subscriptionCreatedAt.getTime() > input.changedAt.getTime()) {
    return "subscription_created_after_event";
  }

  return null;
}

export function buildPushDeliveryKey(eventId: string, subscriptionId: string) {
  return `push:${eventId}:${subscriptionId}`;
}

export function getPushErrorStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return null;
}

export function shouldDeactivatePushSubscription(error: unknown) {
  const statusCode = getPushErrorStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

function formatShortDateTime(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function buildPushCopy(input: {
  eventKind: PushEventKind;
  title: string;
  locationLabel?: string | null;
  theatreCount?: number | null;
  nextShowingAt?: Date | string | null;
}) {
  const locationText = input.locationLabel?.trim()
    ? ` near ${input.locationLabel.trim()}`
    : " near you";

  const nextShowingText = formatShortDateTime(input.nextShowingAt);

  switch (input.eventKind) {
    case "newly_scheduled":
      return {
        title: "Newly scheduled",
        body: `${input.title} just picked up local showtimes${locationText}.`,
        tag: `newly-scheduled:${input.title}`,
      };

    case "now_playing":
      return {
        title: "Now playing",
        body: `${input.title} is now playing${locationText}.`,
        tag: `now-playing:${input.title}`,
      };

    case "advance_tickets":
      return {
        title: "Advance tickets available",
        body: nextShowingText
          ? `${input.title} has advance tickets${locationText}. First nearby showing: ${nextShowingText}.`
          : `${input.title} has advance tickets${locationText}.`,
        tag: `advance-tickets:${input.title}`,
      };

    case "theatre_count_increased":
      return {
        title: "More nearby theatres",
        body:
          input.theatreCount && input.theatreCount > 1
            ? `${input.title} is now listed at ${input.theatreCount} nearby theatres.`
            : `${input.title} expanded to additional nearby theatres.`,
        tag: `theatre-count:${input.title}`,
      };

    case "final_showing_soon":
      return {
        title: "Final local showings soon",
        body: nextShowingText
          ? `${input.title} may be finishing its local run soon. Next showing: ${nextShowingText}.`
          : `${input.title} may be finishing its local run soon.`,
        tag: `final-showing:${input.title}`,
      };
  }
}
