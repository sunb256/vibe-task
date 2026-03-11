import { afterEach, vi } from "vitest";

import { fetchSettings, updateSettings } from "./settingsApi";

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetches app settings", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ headerBand: "zinc" })),
  );

  const response = await fetchSettings();

  expect(response).toEqual({ headerBand: "zinc" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/settings",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test("updates header band setting", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ headerBand: "navy" })),
  );

  const response = await updateSettings("navy");

  expect(response).toEqual({ headerBand: "navy" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/settings",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ headerBand: "navy" }),
    }),
  );
});
