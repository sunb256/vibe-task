import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";

export function CustomPromptPage() {
  return (
    <PageFrame eyebrow="VIBE TASK" title="Custom Prompt">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
        <Notice tone="neutral" message="Custom Prompt 画面は準備中です。" />
      </section>
    </PageFrame>
  );
}
