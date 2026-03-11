import { type FormEvent, type MouseEvent, useEffect, useState } from "react";

import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";
import { defaultAppSettings, type AppSettings, headerColorPresets } from "../../lib/appSettings";
import { updateAppSettings } from "../../lib/appSettingsApi";
import { exportProjectsFile, importProjectsFile } from "./projectApi";

type ProjectSettingsDialogProps = {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaved: (settings: AppSettings) => void;
};

export function ProjectSettingsDialog(props: ProjectSettingsDialogProps) {
  const { isOpen, settings, onClose, onSaved } = props;
  const currentSettings = settings ?? defaultAppSettings;
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [headerColor, setHeaderColor] = useState(currentSettings.headerColor);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingColor, setIsSavingColor] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setError("");
    setFile(null);
    setHeaderColor(currentSettings.headerColor);
  }, [currentSettings.headerColor, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleExport() {
    setError("");
    setIsExporting(true);
    try {
      const response = await exportProjectsFile();
      downloadYaml("projects.yml", response.content);
    } catch (loadError) {
      setError(readError(loadError, "projects.yml のエクスポートに失敗しました。"));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }
    setError("");
    setIsImporting(true);
    try {
      const content = await file.text();
      await importProjectsFile(content);
      window.location.reload();
    } catch (saveError) {
      setError(readError(saveError, "projects.yml のインポートに失敗しました。"));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSaveColor() {
    setError("");
    setIsSavingColor(true);
    try {
      const saved = await updateAppSettings({ headerColor });
      onSaved(saved);
    } catch (saveError) {
      setError(readError(saveError, "ヘッダ色の保存に失敗しました。"));
    } finally {
      setIsSavingColor(false);
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
        className="w-full max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-8 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="project-settings-title" className="text-xl font-semibold">
              Setting
            </h2>
          </div>
        </div>
        <div className="grid gap-4">
          <section className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-[var(--ink)]">固定ヘッダ</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              固定ヘッダの帯色を変更して保存します。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {headerColorPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${color} を選択`}
                  aria-pressed={headerColor === color}
                  onClick={() => setHeaderColor(color)}
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    headerColor === color
                      ? "border-[var(--ink)] ring-2 ring-[var(--accent)]/20"
                      : "border-white/80 hover:border-[var(--border)]"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="grid gap-1 text-sm text-[var(--ink)]">
                カスタムカラー
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={headerColor}
                    onChange={(event) => setHeaderColor(event.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-[var(--border)] bg-white p-1"
                  />
                  <code className="rounded-md bg-zinc-100 px-2 py-1 text-xs">{headerColor}</code>
                </div>
              </label>
              <PrimaryButton
                type="button"
                onClick={() => void handleSaveColor()}
                disabled={isSavingColor}
              >
                {isSavingColor ? "保存中..." : "ヘッダ色を保存"}
              </PrimaryButton>
            </div>
          </section>
          <section className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-[var(--ink)]">データエクスポート</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">projects.yml をダウンロードします。</p>
            <div className="mt-3">
              <PrimaryButton type="button" onClick={() => void handleExport()} disabled={isExporting}>
                {isExporting ? "エクスポート中..." : "projects.yml をエクスポート"}
              </PrimaryButton>
            </div>
          </section>
          <section className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-[var(--ink)]">データインポート</h3>
            <form className="mt-3 grid gap-3" onSubmit={handleImport}>
              <label className="grid gap-1 text-sm text-[var(--ink)]">
                projects.yml
                <input
                  type="file"
                  accept=".yml,.yaml"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end">
                <PrimaryButton type="submit" disabled={!file || isImporting}>
                  {isImporting ? "インポート中..." : "インポート"}
                </PrimaryButton>
              </div>
            </form>
          </section>
          {error ? <Notice tone="error" message={error} /> : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadYaml(fileName: string, content: string) {
  const blob = new Blob([content], { type: "application/x-yaml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
