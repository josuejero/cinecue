import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ClassValue = string | false | null | undefined;

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type PanelTone = "default" | "soft" | "contrast";
type NoticeTone = "neutral" | "warning" | "success" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--paper)] disabled:pointer-events-none disabled:opacity-55 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--accent-strong)] text-[color:var(--accent-ink)] shadow-[var(--shadow-button)] hover:bg-[color:var(--accent)]",
  secondary:
    "border border-[color:var(--line-strong)] bg-white/82 text-[color:var(--foreground)] shadow-[var(--shadow-soft)] hover:border-[color:var(--accent)] hover:bg-white",
  ghost:
    "border border-transparent bg-transparent text-[color:var(--foreground-muted)] hover:bg-white/60 hover:text-[color:var(--foreground)]",
  danger:
    "bg-[color:var(--oxblood)] text-white shadow-[var(--shadow-button)] hover:bg-[color:var(--oxblood-deep)]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
};

const panelTones: Record<PanelTone, string> = {
  default:
    "border border-[color:var(--line)] bg-white/82 shadow-[var(--shadow-card)] backdrop-blur-sm",
  soft:
    "border border-[color:var(--line)] bg-[color:var(--panel-soft)]/92 shadow-[var(--shadow-soft)] backdrop-blur-sm",
  contrast:
    "border border-white/10 bg-[linear-gradient(145deg,rgba(40,26,20,0.96),rgba(24,16,13,0.96))] text-[color:var(--contrast-foreground)] shadow-[var(--shadow-deep)]",
};

const noticeTones: Record<NoticeTone, string> = {
  neutral:
    "border-[color:rgba(57,45,35,0.12)] bg-[color:rgba(255,255,255,0.75)] text-[color:var(--foreground-muted)]",
  warning:
    "border-[color:rgba(174,119,44,0.24)] bg-[color:rgba(255,242,221,0.92)] text-[color:var(--amber-deep)]",
  success:
    "border-[color:rgba(45,117,85,0.22)] bg-[color:rgba(232,247,239,0.94)] text-[color:var(--emerald-deep)]",
  danger:
    "border-[color:rgba(133,39,49,0.2)] bg-[color:rgba(251,236,239,0.94)] text-[color:var(--rose-deep)]",
};

export function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export function buttonClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function panelClassName(tone: PanelTone = "default", className?: string) {
  return cx(
    "rounded-[calc(var(--radius-panel)+4px)]",
    panelTones[tone],
    className,
  );
}

type ActionButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconAfter?: ReactNode;
};

export function ActionButton({
  children,
  className,
  icon,
  iconAfter,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      className={buttonClassName(variant, size, className)}
      type={type}
    >
      {icon}
      <span>{children}</span>
      {iconAfter}
    </button>
  );
}

type ActionLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconAfter?: ReactNode;
};

export function ActionLink({
  children,
  className,
  icon,
  iconAfter,
  size = "md",
  variant = "secondary",
  ...props
}: ActionLinkProps) {
  return (
    <Link {...props} className={buttonClassName(variant, size, className)}>
      {icon}
      <span>{children}</span>
      {iconAfter}
    </Link>
  );
}

type ActionAnchorProps = ComponentProps<"a"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconAfter?: ReactNode;
};

export function ActionAnchor({
  children,
  className,
  icon,
  iconAfter,
  size = "md",
  variant = "secondary",
  ...props
}: ActionAnchorProps) {
  return (
    <a {...props} className={buttonClassName(variant, size, className)}>
      {icon}
      <span>{children}</span>
      {iconAfter}
    </a>
  );
}

export function Panel({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
}) {
  return <div className={panelClassName(tone, className)}>{children}</div>;
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-[color:var(--foreground-soft)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cx("space-y-3", align === "center" && "text-center")}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="font-display text-3xl tracking-[-0.03em] text-[color:var(--foreground)] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)] sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({
  children,
  className,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  className?: string;
  tone?: NoticeTone;
  title?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-[calc(var(--radius-card)+2px)] border px-4 py-3 text-sm leading-6",
        noticeTones[tone],
        className,
      )}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export function MetaPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/68 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground-muted)] shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  const { className, ...rest } = props;

  return (
    <input
      {...rest}
      className={cx(
        "h-12 w-full rounded-[calc(var(--radius-card)-2px)] border border-[color:var(--line-strong)] bg-white/78 px-4 text-sm text-[color:var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition placeholder:text-[color:var(--foreground-soft)] focus:border-[color:var(--accent)] focus:bg-white focus:ring-4 focus:ring-[color:rgba(181,141,78,0.14)]",
        className,
      )}
    />
  );
}

export function SelectInput(props: ComponentProps<"select">) {
  const { className, ...rest } = props;

  return (
    <select
      {...rest}
      className={cx(
        "h-12 w-full rounded-[calc(var(--radius-card)-2px)] border border-[color:var(--line-strong)] bg-white/78 px-4 text-sm text-[color:var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[color:var(--accent)] focus:bg-white focus:ring-4 focus:ring-[color:rgba(181,141,78,0.14)]",
        className,
      )}
    />
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--foreground-soft)]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

export function CheckboxRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  onChange: ComponentProps<"input">["onChange"];
}) {
  return (
    <label className="flex gap-4 rounded-[calc(var(--radius-card)+2px)] border border-[color:var(--line)] bg-white/64 p-4 shadow-[var(--shadow-soft)] transition hover:border-[color:var(--line-strong)]">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-[color:var(--line-strong)] accent-[color:var(--accent-strong)]"
        disabled={disabled}
        onChange={onChange}
        type="checkbox"
      />
      <span className="space-y-1">
        <span className="block font-semibold text-[color:var(--foreground)]">{label}</span>
        <span className="block text-sm leading-6 text-[color:var(--foreground-muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}

export function EmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <Panel className="p-8 text-center" tone="soft">
      <div className="mx-auto max-w-xl space-y-3">
        <h3 className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]">
          {title}
        </h3>
        <p className="text-sm leading-7 text-[color:var(--foreground-muted)]">{children}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </Panel>
  );
}

export function PosterArt({
  alt,
  className,
  src,
  title,
}: {
  alt?: string;
  className?: string;
  src?: string | null;
  title: string;
}) {
  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-[28px] border border-white/40 bg-[linear-gradient(160deg,rgba(181,141,78,0.38),rgba(92,41,48,0.62)_45%,rgba(34,25,21,0.95))] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt ?? title}
          className="h-full w-full object-cover transition duration-500 ease-out motion-safe:group-hover:scale-[1.04] motion-reduce:transform-none"
          src={src}
        />
      ) : (
        <div className="flex h-full w-full items-end p-5">
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-full border border-white/20 bg-white/10" />
            <p className="max-w-[10rem] font-display text-2xl leading-none tracking-[-0.04em] text-white">
              {title}
            </p>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,10,0.06),rgba(18,12,10,0.68))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(18,12,10,0),rgba(18,12,10,0.92))]" />
    </div>
  );
}

export function Dot() {
  return <span className="inline-block h-1 w-1 rounded-full bg-current/45" />;
}

export function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 12H5m5 5-5-5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m12 3 1.85 5.15L19 10l-5.15 1.85L12 17l-1.85-5.15L5 10l5.15-1.85L12 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function MapPinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21c4-4.6 6-7.9 6-10.5A6 6 0 1 0 6 10.5C6 13.1 8 16.4 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M15 18H9m8-2H7l1.2-1.9A6.8 6.8 0 0 0 9 10.4V9.7a3 3 0 1 1 6 0v.7c0 1.3.36 2.57 1.03 3.69L17 16Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.5 18a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 20s-6.5-4.35-8.54-8.15A5.24 5.24 0 0 1 8.1 4.5c1.48 0 2.92.64 3.9 1.76A5.14 5.14 0 0 1 15.9 4.5a5.24 5.24 0 0 1 4.64 7.35C18.5 15.65 12 20 12 20Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PulseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 12h4l2.5-5 3.5 10 2.5-5H21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
