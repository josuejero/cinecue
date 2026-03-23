import type { ReactNode } from "react";
import { Eyebrow, MetaPill, Panel, cx } from "./ui";

const widths = {
  narrow: "max-w-5xl",
  wide: "max-w-7xl",
  landing: "max-w-[88rem]",
};

export function PageShell({
  children,
  className,
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: keyof typeof widths;
}) {
  return (
    <main className={cx("relative min-h-screen px-4 py-5 sm:px-6 sm:py-6 lg:px-8", className)}>
      <div className={cx("mx-auto w-full", widths[width])}>{children}</div>
    </main>
  );
}

export function PageHero({
  actions,
  description,
  eyebrow = "CineCue",
  meta,
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Panel className="cine-enter relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[radial-gradient(circle_at_top,rgba(181,141,78,0.16),transparent_62%)] lg:block" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-display text-4xl tracking-[-0.045em] text-[color:var(--foreground)] sm:text-5xl lg:text-[3.7rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)] sm:text-base">
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-2.5 text-sm">{meta}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </Panel>
  );
}

export function PageHeroMeta({
  items,
}: {
  items: Array<ReactNode | null | undefined>;
}) {
  return (
    <>
      {items.filter(Boolean).map((item, index) => (
        <MetaPill key={index}>{item}</MetaPill>
      ))}
    </>
  );
}
