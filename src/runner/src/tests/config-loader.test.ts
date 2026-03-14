import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { loadRunnerConfig } from "../loader/config-loader.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-config-test-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("loadRunnerConfig returns empty config when file does not exist", async () => {
  await withTempDir(async (dir) => {
    const config = await loadRunnerConfig(path.join(dir, "missing.yml"));
    assert.deepEqual(config, {});
  });
});

test("loadRunnerConfig parses supported fields", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "config.yml");
    const yaml = `
verbose: true
codex:
  command: codex
  args:
    - app-server
thread:
  personality: pragmatic
  service_name: task-yml-runner
reply_wanted:
  mode: fullauto
  auto_reply: true
  max_auto_reply_count: 7
  suffixes:
    - "!"
  patterns:
    - 回答して
prompts:
  task_file: tasks.local.yml
  common: |
    共通の指示
  defaults:
    cwd: /repo
    approval_policy: never
    sandbox: danger-full-access
    model: gpt-5
`;

    await fs.writeFile(filePath, yaml);
    const config = await loadRunnerConfig(filePath);

    assert.deepEqual(config, {
      verbose: true,
      codex: {
        command: "codex",
        args: ["app-server"],
      },
      thread: {
        personality: "pragmatic",
        service_name: "task-yml-runner",
      },
      reply_wanted: {
        mode: "fullauto",
        auto_reply: true,
        max_auto_reply_count: 7,
        suffixes: ["!"],
        patterns: ["回答して"],
      },
      prompts: {
        task_file: "tasks.local.yml",
        common: "共通の指示\n",
        defaults: {
          cwd: "/repo",
          approval_policy: "never",
          sandbox: "danger-full-access",
          model: "gpt-5",
        },
      },
    });
  });
});

test("loadRunnerConfig ignores invalid field types", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "config.yml");
    const yaml = `
verbose: "yes"
codex:
  command: 1
  args: [1, 2]
thread:
  personality: false
  service_name: {}
reply_wanted:
  mode: unknown
  auto_reply: 1
  max_auto_reply_count: -1
  suffixes: [1]
  patterns: null
prompts:
  task_file: []
  common: false
  defaults: hello
`;

    await fs.writeFile(filePath, yaml);
    const config = await loadRunnerConfig(filePath);

    assert.deepEqual(config, {
      verbose: undefined,
      codex: {
        command: undefined,
        args: undefined,
      },
      thread: {
        personality: undefined,
        service_name: undefined,
      },
      reply_wanted: {
        mode: undefined,
        auto_reply: undefined,
        max_auto_reply_count: undefined,
        suffixes: undefined,
        patterns: undefined,
      },
      prompts: {
        task_file: undefined,
        common: undefined,
        defaults: undefined,
      },
    });
  });
});

test("loadRunnerConfig normalizes halfauto mode", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "config.yml");
    const yaml = `
reply_wanted:
  mode: halfauto
`;

    await fs.writeFile(filePath, yaml);
    const config = await loadRunnerConfig(filePath);
    assert.equal(config.reply_wanted?.mode, "harfauto");
  });
});

test("loadRunnerConfig parses max auto reply count", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "config.yml");
    const yaml = `
reply_wanted:
  max_auto_reply_count: 12
`;

    await fs.writeFile(filePath, yaml);
    const config = await loadRunnerConfig(filePath);
    assert.equal(config.reply_wanted?.max_auto_reply_count, 12);
  });
});
