import { afterEach, vi } from "vitest";

import { deleteTask, fetchTasks, swapTaskId, updateTask } from "./taskApi";

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
      }),
    ),
  );

  const response = await fetchTasks("project-1");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/projects/project-1/tasks",
    expect.objectContaining({ body: undefined }),
  );
  expect(response.tasks[0].id).toBe("1");
});

test("updateTask, deleteTask, and swapTaskId use the scoped task endpoint", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
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

  await updateTask("project-1", "action", "1", "updated", "pending");
  await deleteTask("project-1", "done", "2");
  await swapTaskId("project-1", "action", "1", "2");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/projects/project-1/tasks/action/1",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ action: "updated", nextSource: "pending" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/projects/project-1/tasks/done/2",
    expect.objectContaining({ method: "DELETE" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    "/api/projects/project-1/tasks/action/1/swap",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ swapWithId: "2" }),
    }),
  );
});
