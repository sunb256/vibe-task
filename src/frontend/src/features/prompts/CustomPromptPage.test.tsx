import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CustomPromptPage } from "./CustomPromptPage";

test("renders custom prompt page with global menu", () => {
  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("heading", { level: 1, name: "Custom Prompt" })).toBeInTheDocument();
  expect(screen.getByText("Custom Prompt 画面は準備中です。")).toBeInTheDocument();
});
