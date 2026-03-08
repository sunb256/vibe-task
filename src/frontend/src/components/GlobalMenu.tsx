import { NavLink, useLocation } from "react-router-dom";

type MenuItem = {
  to: string;
  label: string;
};

const menuItems: MenuItem[] = [
  { to: "/custom-prompt", label: "Custom Prompt" },
  { to: "/skills", label: "Skills" },
];

export function GlobalMenu() {
  const { pathname } = useLocation();
  const logoSrc = selectLogoSrc(pathname);

  return (
    <nav className="flex items-center" aria-label="global menu">
      <NavLink
        to="/"
        end
        aria-label="Project"
        className={({ isActive }) => logoLinkClass(isActive)}
      >
        <img src={logoSrc} alt="" aria-hidden="true" className="h-5 w-auto select-none" />
      </NavLink>
      <div className="ml-5 flex items-center gap-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => menuLinkClass(isActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
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
