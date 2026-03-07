import type { ReactNode } from "react";

type PageFrameProps = {
  title: ReactNode;
  eyebrow?: string | null;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const { title, eyebrow = "Task Manager", subtitle, actions, children } =
    props;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-3 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_18px_40px_rgba(9,9,11,0.08)] md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-700/80">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
            {subtitle ? (
              <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
