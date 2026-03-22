import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import YAML from "yaml";
import { appendRunnerHistory, loadTasks } from "../loader/task-loader.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-task-test-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("loadTasks reads task array and defaults", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "tasks.yml");
    const yaml = `
defaults:
  cwd: /repo
task:
  - id: 1
    action: hello
`;

    await fs.writeFile(filePath, yaml);
    const loaded = await loadTasks(filePath);

    assert.deepEqual(loaded, {
      tasks: [{ id: 1, action: "hello" }],
      defaults: { cwd: "/repo" },
    });
  });
});

test("loadTasks supports tasks key", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "tasks.yml");
    const yaml = `
tasks:
  - id: "2"
    action: world
`;

    await fs.writeFile(filePath, yaml);
    const loaded = await loadTasks(filePath);
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.tasks[0]?.id, "2");
    assert.equal(loaded.tasks[0]?.action, "world");
  });
});

test("loadTasks throws when task array is missing", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "tasks.yml");
    await fs.writeFile(filePath, "defaults:\n  cwd: /repo\n");

    await assert.rejects(
      async () => {
        await loadTasks(filePath);
      },
      /task\.yml must contain 'task:' or 'tasks:' array/
    );
  });
});

test("appendRunnerHistory appends history entry to runner.yml", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "runner.yml");
    const yaml = `
task:
  - id: 1
    action: hello
history:
  - id: [1]
    datetime: "2026-03-22 09:00:00"
    status: done
`;

    await fs.writeFile(filePath, yaml);
    await appendRunnerHistory(filePath, {
      id: ["1", "2"],
      datetime: "2026-03-22 10:00:00",
      status: "error",
    });

    const updated = YAML.parse(await fs.readFile(filePath, "utf8")) as {
      history?: Array<{ id: unknown; datetime: string; status: string }>;
    };
    assert.equal(updated.history?.length, 2);
    assert.deepEqual(updated.history?.[1], {
      id: ["1", "2"],
      datetime: "2026-03-22 10:00:00",
      status: "error",
    });
  });
});

test("appendRunnerHistory does nothing for non-runner task files", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "action.yml");
    const yaml = `
task:
  - id: 1
    action: hello
`;

    await fs.writeFile(filePath, yaml);
    await appendRunnerHistory(filePath, {
      id: ["1"],
      datetime: "2026-03-22 10:00:00",
      status: "done",
    });

    const updated = await fs.readFile(filePath, "utf8");
    assert.equal(updated, yaml);
  });
});
