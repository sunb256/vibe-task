import { afterEach, vi } from "vitest";

import {
  createTask,
  deleteTask,
  executeRunner,
  fetchProjectDoc,
  fetchProjectDocs,
  fetchRunnerLogs,
  fetchTasks,
  swapTaskId,
  updateTask,
} from "./taskApi";

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetchTasks requests the project task list", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        tasks: [
          {
            projectId: "project-1",
            source: "action",
            id: "1",
            title: "-",
            url: "-",
            action: "first task",
          },
        ],
        runnerHistory: [
          {
            id: ["1", "2"],
            datetime: "2026-03-22 09:00:00",
            status: "done",
          },
        ],
      }),
    ),
  );

  const response = await fetchTasks("project-1");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/projects/project-1/tasks",
    expect.objectContaining({ body: undefined }),
  );
  expect(response.tasks[0].id).toBe("1");
  expect(response.runnerHistory?.[0]?.status).toBe("done");
});

test("createTask, updateTask, deleteTask, and swapTaskId use the scoped task endpoint", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          projectId: "project-1",
          source: "runner",
          id: "3",
          title: "-",
          url: "-",
          action: "TODO\n",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "updated",
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  await createTask("project-1", "runner");
  await updateTask("project-1", "action", "1", "updated", "pending");
  await deleteTask("project-1", "done", "2");
  await swapTaskId("project-1", "action", "1", "2");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/projects/project-1/tasks/runner",
    expect.objectContaining({
      method: "POST",
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/projects/project-1/tasks/action/1",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ action: "updated", nextSource: "pending" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    "/api/projects/project-1/tasks/done/2",
    expect.objectContaining({ method: "DELETE" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    4,
    "/api/projects/project-1/tasks/action/1/swap",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ swapWithId: "2" }),
    }),
  );
});

test("fetchProjectDocs and fetchProjectDoc request docs endpoints without cache", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "guide.md",
          path: "docs/guide.md",
          content: "# Guide\n",
        }),
      ),
    );

  await fetchProjectDocs("project-1");
  await fetchProjectDoc("project-1", "docs/guide.md");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/projects/project-1/docs",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/projects/project-1/docs/docs/guide.md",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test("executeRunner and fetchRunnerLogs call runner endpoints", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ running: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ running: false, log: "done" })));

  await executeRunner("project-1");
  await fetchRunnerLogs("project-1", 123);

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/projects/project-1/runner/execute",
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/projects/project-1/runner/logs?lines=123",
    expect.objectContaining({ cache: "no-store" }),
  );
});
