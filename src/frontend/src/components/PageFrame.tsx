import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { ProjectSettingsDialog } from "../features/projects/ProjectSettingsDialog";
import { createTopBarStyle, defaultAppSettings, type AppSettings } from "../lib/appSettings";
import { fetchAppSettings } from "../lib/appSettingsApi";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
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
  const topBarStyle = createTopBarStyle(settings);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const loaded = await fetchAppSettings();
        if (!cancelled && hasCustomSettings(loaded)) {
          setSettings(loaded);
        }
      } catch {
        return;
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header
        style={topBarStyle}
        className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--topbar-border)] bg-[color:var(--topbar-bg)] px-4 text-[color:var(--topbar-ink)] backdrop-blur sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-between gap-4">
          <nav className="flex items-center gap-4" aria-label="global menu">
            <NavLink
              to="/"
              end
              aria-label="Project"
              className={({ isActive }) => menuLinkClass(isActive)}
            >
              <img
                src={logoSrc}
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
            <NavLink
              to="/skills"
              className={({ isActive }) => menuLinkClass(isActive)}
            >
              Skills
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex h-7 items-center rounded-md border border-[color:var(--topbar-border)] px-2.5 text-sm font-semibold text-[color:var(--topbar-ink)] transition hover:bg-[color:var(--topbar-hover)]"
          >
            Setting
          </button>
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
      <ProjectSettingsDialog
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={setSettings}
      />
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
  const activeTone = "text-[color:var(--topbar-ink)]";
  const inactiveTone = "text-[color:var(--topbar-muted)] hover:text-[color:var(--topbar-ink)]";
  return `inline-flex h-6 items-center px-0.5 text-sm font-semibold transition ${isActive ? activeTone : inactiveTone}`;
}

function hasCustomSettings(settings: AppSettings | null | undefined) {
  if (!settings) {
    return false;
  }
  return settings.headerColor !== defaultAppSettings.headerColor;
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
