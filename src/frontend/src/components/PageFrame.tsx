import type { ReactNode } from "react";

type PageFrameProps = {
  title: ReactNode;
  eyebrow?: string | null;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const { title, eyebrow = "Task YAML Manager", subtitle, actions, children } =
    props;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_18px_60px_rgba(31,43,46,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
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
