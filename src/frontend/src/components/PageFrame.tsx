import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type PageFrameProps = {
  title: ReactNode;
  eyebrow?: string | null;
  subtitle?: string | null;
  headerStyle?: "panel" | "plain";
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const {
    title,
    eyebrow = "VIBE TASK",
    subtitle,
    headerStyle = "panel",
    actions,
    children,
  } =
    props;
  const frameClass = headerClass(headerStyle);
  const titleWrapClass = titleClass(headerStyle);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-[rgba(9,9,11,0.94)] px-4 text-white backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex h-10 max-w-6xl items-center">
          <nav className="flex items-center gap-4" aria-label="global menu">
            <NavLink
              to="/"
              end
              aria-label="Project"
              className={({ isActive }) => menuLinkClass(isActive)}
            >
              <img
                src="/assets/images/vibe_task_logo.png"
                alt=""
                aria-hidden="true"
                className="h-5 w-auto"
              />
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
      <main className="min-h-screen px-4 pb-8 pt-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <header className={frameClass}>
            <div className={titleWrapClass}>
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
            {actions ? <div className="w-full md:flex-1">{actions}</div> : null}
          </header>
          {children}
          <footer className="mt-6">
            <hr className="border-0 border-t border-[var(--border)]/70" />
          </footer>
        </div>
      </main>
    </>
  );
}

function menuLinkClass(isActive: boolean) {
  const activeTone = "text-white";
  const inactiveTone = "text-zinc-400 hover:text-zinc-200";
  return `inline-flex h-6 items-center px-0.5 text-sm font-semibold transition ${isActive ? activeTone : inactiveTone}`;
}

function headerClass(headerStyle: PageFrameProps["headerStyle"]) {
  if (headerStyle === "plain") {
    return "mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between";
  }
  return "mb-3 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_18px_40px_rgba(9,9,11,0.08)] md:flex-row md:items-center md:justify-between";
}

function titleClass(headerStyle: PageFrameProps["headerStyle"]) {
  if (headerStyle === "plain") {
    return "space-y-0";
  }
  return "space-y-1.5";
}
