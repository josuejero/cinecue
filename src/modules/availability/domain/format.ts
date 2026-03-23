import type { MovieAvailabilityStatus } from "@/modules/availability/read-model";

const STATUS_LABELS: Record<MovieAvailabilityStatus, string> = {
  now_playing: "Now playing",
  advance_tickets: "Advance tickets",
  coming_soon: "Coming soon",
  no_local_schedule_yet: "No local schedule yet",
  stopped_playing: "Stopped playing",
};

export function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "TBD";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "TBD";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function humanizeStatus(
  status: MovieAvailabilityStatus | string | null | undefined,
) {
  if (!status) {
    return "Unknown";
  }

  return (
    STATUS_LABELS[status as MovieAvailabilityStatus] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function describeAvailabilityChange(
  previousStatus: string | null | undefined,
  newStatus: string | null | undefined,
) {
  if (newStatus === "now_playing") {
    if (
      previousStatus === null ||
      previousStatus === "no_local_schedule_yet" ||
      previousStatus === "stopped_playing"
    ) {
      return "Newly scheduled near you";
    }

    return "Now playing near you";
  }

  if (newStatus === "advance_tickets") {
    return "Advance tickets available";
  }

  if (newStatus === "stopped_playing") {
    return "Stopped playing near you";
  }

  return humanizeStatus(newStatus);
}
