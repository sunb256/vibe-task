type NoticeProps = {
  tone: "error" | "neutral";
  message: string;
};

const toneClass = {
  error: "border-rose-300 bg-rose-50 text-rose-700",
  neutral: "border-[var(--border)] bg-white text-[var(--muted)]",
};

export function Notice(props: NoticeProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClass[props.tone]}`}>
      {props.message}
    </div>
  );
}
