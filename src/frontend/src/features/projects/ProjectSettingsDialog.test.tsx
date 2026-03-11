import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

vi.mock("../../lib/appSettingsApi", () => ({
  updateAppSettings: vi.fn(),
}));

vi.mock("./projectApi", () => ({
  exportProjectsFile: vi.fn(),
  importProjectsFile: vi.fn(),
}));

import { updateAppSettings } from "../../lib/appSettingsApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectSettingsDialog", () => {
  test("saves header color with preset selection", async () => {
    const onSaved = vi.fn();
    vi.mocked(updateAppSettings).mockResolvedValue({ headerColor: "#1d4ed8" });

    render(
      <ProjectSettingsDialog
        isOpen
        settings={{ headerColor: "#09090b" }}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "#1d4ed8 を選択" }));
    fireEvent.click(screen.getByRole("button", { name: "ヘッダ色を保存" }));

    await waitFor(() => {
      expect(updateAppSettings).toHaveBeenCalledWith({ headerColor: "#1d4ed8" });
    });
    expect(onSaved).toHaveBeenCalledWith({ headerColor: "#1d4ed8" });
  });
});
