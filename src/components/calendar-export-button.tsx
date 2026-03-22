export function CalendarExportButton(props: { href: string }) {
  return (
    <a
      className="inline-flex h-11 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900"
      href={props.href}
    >
      Export .ics
    </a>
  );
}
