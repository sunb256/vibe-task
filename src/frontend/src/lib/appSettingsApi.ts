import type { AppSettings } from "./appSettings";
import { apiFetch } from "./api";

type AppSettingsResponse = {
  settings: AppSettings;
};

export async function fetchAppSettings() {
  const response = await apiFetch<AppSettingsResponse>("/api/settings");
  return response.settings;
}

export async function updateAppSettings(payload: AppSettings) {
  const response = await apiFetch<AppSettingsResponse>("/api/settings", {
    method: "PATCH",
    json: payload,
  });
  return response.settings;
}
