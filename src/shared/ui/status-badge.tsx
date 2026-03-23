import { humanizeStatus } from "@/modules/availability/domain/format";
import { cx } from "./ui";

const statusTones: Record<string, string> = {
  now_playing:
    "border-[color:rgba(66,134,97,0.18)] bg-[color:rgba(232,247,239,0.92)] text-[color:var(--emerald-deep)]",
  advance_tickets:
    "border-[color:rgba(84,105,146,0.18)] bg-[color:rgba(235,241,252,0.92)] text-[color:var(--navy-deep)]",
  coming_soon:
    "border-[color:rgba(140,81,71,0.18)] bg-[color:rgba(249,237,232,0.94)] text-[color:var(--oxblood)]",
  stopped_playing:
    "border-[color:rgba(57,45,35,0.12)] bg-[color:rgba(242,237,231,0.94)] text-[color:var(--foreground-muted)]",
  no_local_schedule_yet:
    "border-[color:rgba(174,119,44,0.2)] bg-[color:rgba(255,244,225,0.92)] text-[color:var(--amber-deep)]",
};

export function statusBadgeClassName(status: string | null | undefined) {
  if (!status) {
    return statusTones.no_local_schedule_yet;
  }

  return statusTones[status] ?? statusTones.no_local_schedule_yet;
}

export function StatusBadge({
  className,
  status,
}: {
  className?: string;
  status: string | null | undefined;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase",
        statusBadgeClassName(status),
        className,
      )}
    >
      {humanizeStatus(status)}
    </span>
  );
}
