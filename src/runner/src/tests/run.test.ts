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
  resolveRepositoryDirFromEnv,
  resolveRepositoryDirFromProjectName,
  resolveDefaultsCwd,
  resolveTaskProjectSelection,
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

test("parseRuntimeOptions sets max auto reply count from config", () => {
  const runtime = parseRuntimeOptions([], {
    reply_wanted: { max_auto_reply_count: 5 },
  });
  assert.equal(runtime.maxAutoReplyCount, 5);
});

test("parseRuntimeOptions enables verbose with --verbose", () => {
  const runtime = parseRuntimeOptions(["--verbose"], {});
  assert.equal(runtime.verbose, true);
});

test("parseRuntimeOptions keeps verbose true from config", () => {
  const runtime = parseRuntimeOptions([], { verbose: true });
  assert.equal(runtime.verbose, true);
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
  assert.equal(runtime.taskFilePath, "../../tasks/projects/tmux-codex-status/runner.yml");
});

test("parseRuntimeOptions derives task file from --task", () => {
  const runtime = parseRuntimeOptions(
    ["--task", "tmux-codex-status"],
    {
      prompts: { task_file: "tasks.local.yml" },
    },
    "/home/yyy/ghq/github.com/xxx/vibe-task/src/runner"
  );
  assert.equal(runtime.taskFilePath, "../../tasks/projects/tmux-codex-status/runner.yml");
});

test("parseRuntimeOptions derives task file from --task=project", () => {
  const runtime = parseRuntimeOptions(
    ["--task=tmux-codex-status"],
    {},
    "/home/yyy/ghq/github.com/xxx/vibe-task/src/runner"
  );
  assert.equal(runtime.taskFilePath, "../../tasks/projects/tmux-codex-status/runner.yml");
});

test("parseRuntimeOptions derives task file from -t", () => {
  const runtime = parseRuntimeOptions(
    ["-t", "tmux-codex-status"],
    {},
    "/home/yyy/ghq/github.com/xxx/vibe-task/src/runner"
  );
  assert.equal(runtime.taskFilePath, "../../tasks/projects/tmux-codex-status/runner.yml");
});

test("parseRuntimeOptions sets showHelp with -h", () => {
  const runtime = parseRuntimeOptions(["-h"], {});
  assert.equal(runtime.showHelp, true);
});

test("parseRuntimeOptions sets showHelp with --help", () => {
  const runtime = parseRuntimeOptions(["--help"], {});
  assert.equal(runtime.showHelp, true);
});

test("parseRuntimeOptions throws on unsupported old option", () => {
  assert.throws(() => parseRuntimeOptions(["-f"], {}), /Unsupported option: -f/);
});

test("parseRuntimeOptions throws on unsupported max reply option", () => {
  assert.throws(
    () => parseRuntimeOptions(["--max-auto-reply-count", "3"], {}),
    /Unsupported option: --max-auto-reply-count/
  );
});

test("parseRuntimeOptions throws on positional arguments", () => {
  assert.throws(
    () => parseRuntimeOptions(["tasks.local.yml"], {}),
    /Positional arguments are not supported: tasks.local.yml/
  );
});

test("parseRuntimeOptions throws when -t value is missing", () => {
  assert.throws(
    () => parseRuntimeOptions(["-t"], {}),
    /-t option requires a project name/
  );
});

test("shouldPromptProjectSelection is true when prompts and task option are missing", () => {
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

test("shouldPromptProjectSelection is false when --task exists", () => {
  const value = shouldPromptProjectSelection(["--task", "vibe-task"], {});
  assert.equal(value, false);
});

test("shouldPromptProjectSelection is false when -t exists", () => {
  const value = shouldPromptProjectSelection(["-t", "vibe-task"], {});
  assert.equal(value, false);
});

test("shouldPromptProjectSelection is false when help option exists", () => {
  const value = shouldPromptProjectSelection(["-h"], {});
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

test("resolveRepositoryDirFromEnv expands HOME variable", () => {
  const value = resolveRepositoryDirFromEnv(
    "/app/src/runner",
    {
      RUNNER_REPOSITORY_DIR: "$HOME/ghq/github.com/sunb256/vibe-task",
      HOME: "/Users/user",
    } as NodeJS.ProcessEnv
  );
  assert.equal(value, "/Users/user/ghq/github.com/sunb256/vibe-task");
});

test("resolveRepositoryDirFromEnv resolves relative path from runner root", () => {
  const value = resolveRepositoryDirFromEnv(
    "/app/src/runner",
    {
      RUNNER_REPOSITORY_DIR: "../../workspace/repo",
    } as NodeJS.ProcessEnv
  );
  assert.equal(value, "/app/workspace/repo");
});

test("resolveRepositoryDirFromEnv returns undefined when env value is empty", () => {
  const value = resolveRepositoryDirFromEnv(
    "/app/src/runner",
    {
      RUNNER_REPOSITORY_DIR: "  ",
    } as NodeJS.ProcessEnv
  );
  assert.equal(value, undefined);
});

test("resolveTaskProjectSelection throws on invalid project name", () => {
  assert.throws(
    () =>
      resolveTaskProjectSelection(
        "/home/sunb/ghq/github.com/sunb256/vibe-task/src/runner",
        "unknown-project",
        ["vibe-task", "tmux-codex-status"]
      ),
    /Project not found for --task: unknown-project/
  );
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

test("parseConfigPathOption throws when config value is missing", () => {
  assert.throws(
    () => parseConfigPathOption(["--config"]),
    /--config option requires a path/
  );
});

test("parseConfigPathOption throws on unsupported option", () => {
  assert.throws(
    () => parseConfigPathOption(["--fullauto"]),
    /Unsupported option: --fullauto/
  );
});

test("parseConfigPathOption throws on positional arguments", () => {
  assert.throws(
    () => parseConfigPathOption(["tasks.demo.yml"]),
    /Positional arguments are not supported: tasks.demo.yml/
  );
});
