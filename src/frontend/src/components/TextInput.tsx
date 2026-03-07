import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextInput(props: TextInputProps) {
  const { label, id, className = "", ...inputProps } = props;

  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <input
        {...inputProps}
        id={id}
        className={`rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(9,9,11,0.04)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12 ${className}`}
      />
    </label>
  );
}
