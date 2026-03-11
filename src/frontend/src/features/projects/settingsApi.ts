import type { HeaderBandId } from "../../lib/headerBand";
import { apiFetch } from "../../lib/api";

export type AppSettings = {
  headerBand: HeaderBandId;
};

export function fetchSettings() {
  return apiFetch<AppSettings>("/api/settings", { cache: "no-store" });
}

export function updateSettings(headerBand: HeaderBandId) {
  return apiFetch<AppSettings>("/api/settings", {
    method: "PATCH",
    json: { headerBand },
  });
}
