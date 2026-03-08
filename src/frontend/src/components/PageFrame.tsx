import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type PageFrameProps = {
  title: ReactNode;
  eyebrow?: string | null;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const { title, eyebrow = "VIBE TASK", subtitle, actions, children } =
    props;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[rgba(252,252,253,0.9)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2" aria-label="global menu">
            <NavLink to="/" end className={({ isActive }) => menuLinkClass(isActive)}>
              Project
            </NavLink>
            <NavLink
              to="/custom-prompt"
              className={({ isActive }) => menuLinkClass(isActive)}
            >
              Custom Prompt
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="min-h-screen px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-3 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_18px_40px_rgba(9,9,11,0.08)] md:flex-row md:items-end md:justify-between">
            <div className="space-y-1.5">
              {eyebrow ? (
                <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-sky-700/80">
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
    </>
  );
}

function menuLinkClass(isActive: boolean) {
  const activeTone = "border-[var(--ink)] bg-white text-[var(--ink)]";
  const inactiveTone =
    "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--ink)]";
  return `inline-flex h-8 items-center rounded-md border px-3 text-sm font-semibold transition ${isActive ? activeTone : inactiveTone}`;
}
