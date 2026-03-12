import { useEffect, useState } from "react";

import { defaultBandId, resolveHeaderBandStyle } from "../lib/headerBand";
import { ProjectSettingsDialog } from "../features/projects/ProjectSettingsDialog";
import type { AppSettings } from "../features/projects/settingsApi";
import { fetchSettings } from "../features/projects/settingsApi";
import { GlobalMenu } from "./GlobalMenu";

type GlobalHeaderProps = {
  onImported?: () => Promise<void> | void;
};

export function GlobalHeader(props: GlobalHeaderProps) {
  const { onImported } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    headerBand: defaultBandId,
    customHeaderColor: "",
  });
  const band = resolveHeaderBandStyle(settings.headerBand, settings.customHeaderColor);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const nextSettings = await fetchSettings();
        if (!cancelled) {
          setSettings(nextSettings);
        }
      } catch {
        if (!cancelled) {
          setSettings({ headerBand: defaultBandId, customHeaderColor: "" });
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 border-b px-4 text-white backdrop-blur sm:px-6 lg:px-8"
        style={{ backgroundColor: band.background, borderColor: band.border }}
      >
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-between gap-4">
          <GlobalMenu />
          <button type="button" onClick={() => setIsOpen(true)} className={settingButtonClass()}>
            Setting
          </button>
        </div>
      </header>
      <ProjectSettingsDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onImported={onImported}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </>
  );
}

function settingButtonClass() {
  return "inline-flex h-8 items-center rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";
}
