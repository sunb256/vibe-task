import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectListPage } from "./ProjectListPage";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders project cards", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
            actionListPath: "tasks/action.yml",
            doneListPath: "tasks/done.yml",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });
  expect(screen.getByRole("link", { name: "Open Project" })).toHaveAttribute(
    "href",
    "/projects/project-1",
  );
});
