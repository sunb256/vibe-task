import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton(props: PrimaryButtonProps) {
  const { className = "", children, ...buttonProps } = props;

  return (
    <button
      {...buttonProps}
      className={`rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium tracking-tight text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
