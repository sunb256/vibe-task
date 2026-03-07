type NoticeProps = {
  tone: "error" | "neutral";
  message: string;
};

const toneClass = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]",
};

export function Notice(props: NoticeProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass[props.tone]}`}>
      {props.message}
    </div>
  );
}
