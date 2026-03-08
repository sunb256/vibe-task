import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

type PageFrameProps = {
  title: ReactNode;
  eyebrow?: string | null;
  subtitle?: string | null;
  headerStyle?: "panel" | "plain";
  actions?: ReactNode;
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  const { pathname } = useLocation();
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
  const logoSrc = selectLogoSrc(pathname);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-[rgba(9,9,11,0.94)] px-4 text-white backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex h-10 max-w-6xl items-center">
          <nav className="flex items-center" aria-label="global menu">
            <NavLink
              to="/"
              end
              aria-label="Project"
              className={({ isActive }) => logoLinkClass(isActive)}
            >
              <img
                src={logoSrc}
                alt=""
                aria-hidden="true"
                className="h-5 w-auto select-none"
              />
            </NavLink>
            <div className="ml-5 flex items-center gap-4">
              <NavLink
                to="/custom-prompt"
                className={({ isActive }) => menuLinkClass(isActive)}
              >
                Custom Prompt
              </NavLink>
              <NavLink
                to="/skills"
                className={({ isActive }) => menuLinkClass(isActive)}
              >
                Skills
              </NavLink>
            </div>
          </nav>
        </div>
      </header>
      <main className="min-h-screen px-4 pb-8 pt-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-6xl flex-col">
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
          <div className="flex-1">{children}</div>
          <footer className="mt-auto pt-2">
            <hr className="border-0 border-t border-[var(--border)] opacity-70" />
          </footer>
        </div>
      </main>
    </>
  );
}

function selectLogoSrc(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/projects/")) {
    return "/assets/images/vibe_task_logo_active.png";
  }
  return "/assets/images/vibe_task_logo.png";
}

function menuLinkClass(isActive: boolean) {
  const activeTone = "text-white";
  const inactiveTone = "text-zinc-400 hover:text-zinc-200";
  return `inline-flex h-6 items-center whitespace-nowrap px-0.5 text-sm font-semibold transition ${isActive ? activeTone : inactiveTone}`;
}

function logoLinkClass(isActive: boolean) {
  const activeTone = "text-white";
  const inactiveTone = "text-zinc-400";
  return `inline-flex h-6 shrink-0 items-center rounded-sm px-0.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 ${isActive ? activeTone : inactiveTone}`;
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
