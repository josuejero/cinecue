import { ActionAnchor, DownloadIcon } from "@/components/ui";
import type { ReactNode } from "react";

export function CalendarExportButton(props: {
  href: string;
  className?: string;
  children?: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <ActionAnchor
      className={props.className}
      href={props.href}
      icon={props.icon ?? <DownloadIcon />}
      size={props.size ?? "md"}
      variant={props.variant ?? "secondary"}
    >
      {props.children ?? "Export .ics"}
    </ActionAnchor>
  );
}
