import type { HeaderBandId } from "../../lib/headerBand";
import { apiFetch } from "../../lib/api";

export type AppSettings = {
  headerBand: HeaderBandId;
  customHeaderColor: string;
};

export function fetchSettings() {
  return apiFetch<AppSettings>("/api/settings", { cache: "no-store" });
}

export function updateSettings(settings: AppSettings) {
  return apiFetch<AppSettings>("/api/settings", {
    method: "PATCH",
    json: settings,
  });
}
