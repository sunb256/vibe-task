import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { loadTasks } from "./task-loader.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-task-test-"));
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
