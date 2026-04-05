type SearchInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
};

export function SearchInput(props: SearchInputProps) {
  const wrapperClassName = props.wrapperClassName ?? "w-full min-w-48 max-w-64";
  return (
    <div className={`relative ${wrapperClassName}`}>
      <img
        src="/assets/images/search.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-65"
      />
      <input
        id={props.id}
        type="search"
        aria-label={props.ariaLabel ?? "Search"}
        autoFocus={props.autoFocus}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder ?? "Search"}
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12"
      />
    </div>
  );
}
