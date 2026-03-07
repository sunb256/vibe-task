import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(props, ref) {
    const { className = "", children, ...buttonProps } = props;

    return (
      <button
        ref={ref}
        {...buttonProps}
        className={`rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium tracking-tight text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {children}
      </button>
    );
  },
);
