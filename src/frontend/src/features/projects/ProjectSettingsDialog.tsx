import { type FormEvent, type MouseEvent, useEffect, useState } from "react";

import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";
import {
  listHeaderBands,
  normalizeCustomHeaderColor,
  resolveHeaderBandStyle,
  type HeaderBandId,
} from "../../lib/headerBand";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { exportProjectsFile, importProjectsFile } from "./projectApi";
import { fetchSettings, updateSettings, type AppSettings } from "./settingsApi";

type ProjectSettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => Promise<void> | void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
};

export function ProjectSettingsDialog(props: ProjectSettingsDialogProps) {
  const { isOpen, onClose, onImported, settings, onSettingsChange } = props;
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingBand, setIsUpdatingBand] = useState(false);
  const [customColor, setCustomColor] = useState("#1f2937");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setError("");
    setFile(null);
    setCustomColor(normalizeDialogColor(settings.customHeaderColor));
  }, [isOpen, settings.customHeaderColor]);

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
      setError(readErrorMessage(loadError, "projects.yml のエクスポートに失敗しました。"));
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
      await onImported?.();
      const settings = await fetchSettings();
      onSettingsChange(settings);
      onClose();
    } catch (saveError) {
      setError(readErrorMessage(saveError, "projects.yml のインポートに失敗しました。"));
    } finally {
      setIsImporting(false);
    }
  }

  async function saveSettings(nextSettings: AppSettings) {
    setError("");
    setIsUpdatingBand(true);
    try {
      const saved = await updateSettings(nextSettings);
      onSettingsChange(saved);
    } catch (saveError) {
      setError(readErrorMessage(saveError, "固定ヘッダ設定の更新に失敗しました。"));
    } finally {
      setIsUpdatingBand(false);
    }
  }

  async function handleBandChange(bandId: HeaderBandId) {
    await saveSettings({
      headerBand: bandId,
      customHeaderColor: normalizeCustomHeaderColor(customColor),
    });
  }

  async function handleCustomApply() {
    await saveSettings({
      headerBand: "custom",
      customHeaderColor: normalizeCustomHeaderColor(customColor),
    });
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
        className="max-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-8 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
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
              暗めの固定ヘッダ帯を切り替えます。任意色は Custom から設定できます。
            </p>
            <div role="radiogroup" aria-label="固定ヘッダの帯" className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {listHeaderBands().map((band) => (
                <label
                  key={band.id}
                  className={`grid gap-3 rounded-lg border p-3 transition ${
                    settings.headerBand === band.id
                      ? "border-[var(--accent)] bg-zinc-50 shadow-[0_0_0_1px_var(--accent)]"
                      : "border-[var(--border)] bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid gap-1">
                      <span className="text-sm font-semibold text-[var(--ink)]">{band.label}</span>
                      <span className="text-xs leading-5 text-[var(--muted)]">
                        {band.description}
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="header-band"
                      value={band.id}
                      checked={settings.headerBand === band.id}
                      disabled={isUpdatingBand}
                      onChange={() => void handleBandChange(band.id)}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-8 rounded-md border"
                    style={previewStyle(band.id, customColor)}
                  />
                  {band.id === "custom" ? (
                    <div className="grid gap-3 border-t border-[var(--border)] pt-3">
                      <label className="grid gap-1 text-xs text-[var(--muted)]">
                        カラーピッカー
                        <input
                          type="color"
                          value={normalizeDialogColor(customColor)}
                          disabled={isUpdatingBand}
                          onChange={(event) => setCustomColor(event.target.value)}
                          className="h-10 w-full rounded-md border border-[var(--border)] bg-white p-1"
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-[var(--muted)]">
                        HEX
                        <input
                          type="text"
                          inputMode="text"
                          value={customColor}
                          disabled={isUpdatingBand}
                          onChange={(event) => setCustomColor(formatHexInput(event.target.value))}
                          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
                        />
                      </label>
                      <PrimaryButton
                        type="button"
                        onClick={() => void handleCustomApply()}
                        disabled={isUpdatingBand || !normalizeCustomHeaderColor(customColor)}
                      >
                        任意色を適用
                      </PrimaryButton>
                    </div>
                  ) : null}
                </label>
              ))}
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

function previewStyle(bandId: HeaderBandId, customColor: string) {
  const band = resolveHeaderBandStyle(bandId, customColor);
  return {
    backgroundColor: band.background,
    borderColor: band.border,
  };
}

function normalizeDialogColor(value: string) {
  return normalizeCustomHeaderColor(value) || "#1f2937";
}

function formatHexInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^#0-9a-f]/g, "");
  if (!normalized) {
    return "#";
  }
  if (normalized.startsWith("#")) {
    return normalized.slice(0, 7);
  }
  return `#${normalized.slice(0, 6)}`;
}
