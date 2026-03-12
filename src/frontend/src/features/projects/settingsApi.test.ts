import { afterEach, vi } from "vitest";

import { fetchSettings, updateSettings } from "./settingsApi";

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetches app settings", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ headerBand: "zinc", customHeaderColor: "" })),
  );

  const response = await fetchSettings();

  expect(response).toEqual({ headerBand: "zinc", customHeaderColor: "" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/settings",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test("updates header band setting", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ headerBand: "navy", customHeaderColor: "#1f2937" })),
  );

  const response = await updateSettings({ headerBand: "navy", customHeaderColor: "#1f2937" });

  expect(response).toEqual({ headerBand: "navy", customHeaderColor: "#1f2937" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/settings",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ headerBand: "navy", customHeaderColor: "#1f2937" }),
    }),
  );
});
