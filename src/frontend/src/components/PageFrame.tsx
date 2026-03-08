import type { ReactNode } from "react";

import { GlobalMenu } from "./GlobalMenu";

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
          <GlobalMenu />
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
