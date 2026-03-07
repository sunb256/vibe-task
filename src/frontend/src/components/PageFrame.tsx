import type { ReactNode } from "react";

type PageFrameProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const { title, subtitle, actions, children } = props;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_18px_60px_rgba(31,43,46,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">
              Task YAML Manager
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {subtitle}
            </p>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
