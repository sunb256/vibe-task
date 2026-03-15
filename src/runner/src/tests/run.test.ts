import * as assert from "node:assert/strict";
import test from "node:test";
import {
  buildTaskPrompt,
  formatCompletedAt,
  formatPromptText,
  mergeTaskDefaults,
  parseConfigPathOption,
  parseProjectSelectionInput,
  parseRuntimeOptions,
  promptConfigToDefaults,
  resolveRepositoryDirFromProjectName,
  resolveDefaultsCwd,
  resolveRunnerPath,
  resolveRunnerRoot,
  shouldPromptProjectSelection,
} from "../run.js";

test("formatCompletedAt formats datetime", () => {
  const value = formatCompletedAt(new Date(2026, 2, 14, 9, 5, 7));
  assert.equal(value, "2026-03-14 09:05:07");
});

test("formatPromptText prefixes each line with input marker", () => {
  const value = formatPromptText("\n入力文です\nテストです、質問に回答して\n");
  assert.equal(value, "> 入力文です\n> テストです、質問に回答して");
});

test("buildTaskPrompt prepends common prompt", () => {
  const value = buildTaskPrompt("個別タスク", "共通指示");
  assert.equal(value, "共通指示\n\n個別タスク");
});

test("mergeTaskDefaults prefers config defaults", () => {
  const value = mergeTaskDefaults(
    { cwd: ".", approval_policy: "on-request", sandbox: "workspace-write" },
    { cwd: "/repo", model: "gpt-5" }
  );
  assert.deepEqual(value, {
    cwd: "/repo",
    approval_policy: "on-request",
    sandbox: "workspace-write",
    model: "gpt-5",
  });
});

test("promptConfigToDefaults maps prompts defaults fields", () => {
  const value = promptConfigToDefaults({
    prompts: {
      repository_dir: "/repo",
      approval_policy: "on-request",
      sandbox: "workspace-write",
    },
  });
  assert.deepEqual(value, {
    cwd: "/repo",
    approval_policy: "on-request",
    sandbox: "workspace-write",
  });
});

test("promptConfigToDefaults uses fallback repository_dir when prompts.repository_dir is missing", () => {
  const value = promptConfigToDefaults(
    {
      prompts: {
        approval_policy: "never",
        sandbox: "workspace-write",
      },
    },
    "/repo/fallback"
  );
  assert.deepEqual(value, {
    cwd: "/repo/fallback",
    approval_policy: "never",
    sandbox: "workspace-write",
  });
});

test("resolveRunnerRoot resolves one level up from script directory", () => {
  const root = resolveRunnerRoot("/tmp/work/runner/src/run.ts");
  assert.equal(root, "/tmp/work/runner");
});

test("resolveRunnerRoot falls back to current directory", () => {
  const root = resolveRunnerRoot(undefined);
  assert.equal(root, process.cwd());
});

test("resolveRunnerPath resolves relative path from runner root", () => {
  const value = resolveRunnerPath("/tmp/work/runner", "config/config.yml");
  assert.equal(value, "/tmp/work/runner/config/config.yml");
});

test("resolveRunnerPath keeps absolute path as-is", () => {
  const value = resolveRunnerPath("/tmp/work/runner", "/etc/app/config.yml");
  assert.equal(value, "/etc/app/config.yml");
});

test("resolveDefaultsCwd resolves relative cwd from runner root", () => {
  const value = resolveDefaultsCwd({ cwd: "." }, "/tmp/work/runner");
  assert.deepEqual(value, { cwd: "/tmp/work/runner" });
});

test("resolveDefaultsCwd keeps absolute cwd", () => {
  const defaults = { cwd: "/tmp/work/runner", model: "gpt-5" } as const;
  const value = resolveDefaultsCwd(defaults, "/base");
  assert.equal(value, defaults);
});

test("parseRuntimeOptions uses harfauto by default", () => {
  const runtime = parseRuntimeOptions([], {});
  assert.equal(runtime.replyMode, "harfauto");
});

test("parseRuntimeOptions enables fullauto from config mode", () => {
  const runtime = parseRuntimeOptions([], {
    reply_wanted: { mode: "fullauto" },
  });
  assert.equal(runtime.replyMode, "fullauto");
});

test("parseRuntimeOptions maps legacy auto_reply to fullauto", () => {
  const runtime = parseRuntimeOptions([], {
    reply_wanted: { auto_reply: true },
  });
  assert.equal(runtime.replyMode, "fullauto");
});

test("parseRuntimeOptions enables fullauto with -f", () => {
  const runtime = parseRuntimeOptions(["-f"], {
    reply_wanted: { mode: "harfauto" },
  });
  assert.equal(runtime.replyMode, "fullauto");
  assert.equal(runtime.taskFilePath, "task.yml");
});

test("parseRuntimeOptions enables fullauto with --fullauto", () => {
  const runtime = parseRuntimeOptions(["--fullauto"], {
    reply_wanted: { mode: "harfauto" },
  });
  assert.equal(runtime.replyMode, "fullauto");
});

test("parseRuntimeOptions enables harfauto with -h", () => {
  const runtime = parseRuntimeOptions(["-h"], {
    reply_wanted: { mode: "fullauto" },
  });
  assert.equal(runtime.replyMode, "harfauto");
});

test("parseRuntimeOptions enables harfauto with --harfauto", () => {
  const runtime = parseRuntimeOptions(["--harfauto"], {
    reply_wanted: { mode: "fullauto" },
  });
  assert.equal(runtime.replyMode, "harfauto");
});

test("parseRuntimeOptions prefers harfauto over fullauto when both set", () => {
  const runtime = parseRuntimeOptions(["-f", "--harfauto"], {});
  assert.equal(runtime.replyMode, "harfauto");
});

test("parseRuntimeOptions keeps positional task file with -f", () => {
  const runtime = parseRuntimeOptions(["-f", "tasks.demo.yml"], {});
  assert.equal(runtime.replyMode, "fullauto");
  assert.equal(runtime.taskFilePath, "tasks.demo.yml");
});

test("parseRuntimeOptions sets max auto reply count from config", () => {
  const runtime = parseRuntimeOptions([], {
    reply_wanted: { max_auto_reply_count: 5 },
  });
  assert.equal(runtime.maxAutoReplyCount, 5);
});

test("parseRuntimeOptions sets max auto reply count from long option", () => {
  const runtime = parseRuntimeOptions(["--max-auto-reply-count=7"], {
    reply_wanted: { max_auto_reply_count: 3 },
  });
  assert.equal(runtime.maxAutoReplyCount, 7);
});

test("parseRuntimeOptions sets max auto reply count from option with value", () => {
  const runtime = parseRuntimeOptions(["--max-auto-reply-count", "8"], {
    reply_wanted: { max_auto_reply_count: 3 },
  });
  assert.equal(runtime.maxAutoReplyCount, 8);
});

test("parseRuntimeOptions sets max auto reply count from short option", () => {
  const runtime = parseRuntimeOptions(["-r", "9"], {
    reply_wanted: { max_auto_reply_count: 3 },
  });
  assert.equal(runtime.maxAutoReplyCount, 9);
});

test("parseRuntimeOptions uses prompts.task_file from config", () => {
  const runtime = parseRuntimeOptions([], {
    prompts: { task_file: "tasks.local.yml" },
  });
  assert.equal(runtime.taskFilePath, "tasks.local.yml");
});

test("parseRuntimeOptions derives task file from prompts.repository_dir", () => {
  const runtime = parseRuntimeOptions(
    [],
    {
      prompts: { repository_dir: "/home/yyy/ghq/github.com/xxx/tmux-codex-status" },
    },
    "/home/yyy/ghq/github.com/xxx/vibe-task/src/runner"
  );
  assert.equal(runtime.taskFilePath, "../../tasks/projects/tmux-codex-status/action.yml");
});

test("shouldPromptProjectSelection is true when prompts and positional task file are missing", () => {
  const value = shouldPromptProjectSelection([], {});
  assert.equal(value, true);
});

test("shouldPromptProjectSelection is false when repository_dir exists", () => {
  const value = shouldPromptProjectSelection([], {
    prompts: { repository_dir: "../.." },
  });
  assert.equal(value, false);
});

test("shouldPromptProjectSelection is false when task_file exists", () => {
  const value = shouldPromptProjectSelection([], {
    prompts: { task_file: "tasks.local.yml" },
  });
  assert.equal(value, false);
});

test("shouldPromptProjectSelection is false when positional task file exists", () => {
  const value = shouldPromptProjectSelection(["tasks.local.yml"], {});
  assert.equal(value, false);
});

test("parseProjectSelectionInput accepts numeric selection", () => {
  const value = parseProjectSelectionInput("2", ["vibe-task", "tmux-codex-status"]);
  assert.equal(value, "tmux-codex-status");
});

test("parseProjectSelectionInput accepts project name selection", () => {
  const value = parseProjectSelectionInput("vibe-task", ["vibe-task", "tmux-codex-status"]);
  assert.equal(value, "vibe-task");
});

test("parseProjectSelectionInput returns undefined on invalid input", () => {
  const value = parseProjectSelectionInput("99", ["vibe-task", "tmux-codex-status"]);
  assert.equal(value, undefined);
});

test("resolveRepositoryDirFromProjectName resolves sibling repository path", () => {
  const value = resolveRepositoryDirFromProjectName(
    "/home/sunb/ghq/github.com/sunb256/vibe-task/src/runner",
    "tmux-codex-status"
  );
  assert.equal(value, "/home/sunb/ghq/github.com/sunb256/tmux-codex-status");
});

test("parseConfigPathOption uses default path without args", () => {
  const value = parseConfigPathOption([]);
  assert.equal(value, "config/config.yml");
});

test("parseConfigPathOption parses short option", () => {
  const value = parseConfigPathOption(["-c", "config/dev.yml"]);
  assert.equal(value, "config/dev.yml");
});

test("parseConfigPathOption parses long option", () => {
  const value = parseConfigPathOption(["--config", "config/prod.yml"]);
  assert.equal(value, "config/prod.yml");
});

test("parseConfigPathOption parses long option with equal", () => {
  const value = parseConfigPathOption(["--config=config/test.yml"]);
  assert.equal(value, "config/test.yml");
});

test("parseConfigPathOption falls back when next token is option", () => {
  const value = parseConfigPathOption(["--config", "--fullauto"]);
  assert.equal(value, "config/config.yml");
});

test("parseRuntimeOptions ignores config option value as task file", () => {
  const runtime = parseRuntimeOptions(["-c", "config/dev.yml", "tasks.demo.yml"], {});
  assert.equal(runtime.taskFilePath, "tasks.demo.yml");
});
