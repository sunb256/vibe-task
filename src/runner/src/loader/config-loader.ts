import * as fs from "node:fs/promises";
import YAML from "yaml";
import type { RunnerConfig } from "../shared/types.js";
import { isRecord } from "../shared/types.js";

// 空文字を除外して文字列設定値を取り出す。
function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

// 真偽値設定を安全に取り出す。
function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

// 文字列配列設定を検証して複製を返す。
function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((x) => typeof x !== "string")) {
    return undefined;
  }
  return [...value];
}

// 実行モード文字列を有効な値へ正規化する。
function getReplyMode(value: unknown): "harfauto" | "fullauto" | undefined {
  if (value === "harfauto" || value === "fullauto") {
    return value;
  }
  if (value === "halfauto") {
    return "harfauto";
  }
  return undefined;
}

// 0以上の整数設定値を取り出す。
function getNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

// YAML解析結果をRunnerConfigへ正規化する。
function parseConfig(value: unknown): RunnerConfig {
  if (!isRecord(value)) return {};

  const codex = isRecord(value.codex)
    ? {
        command: getString(value.codex.command),
        args: getStringArray(value.codex.args),
      }
    : undefined;

  const thread = isRecord(value.thread)
    ? {
        personality: getString(value.thread.personality),
        service_name: getString(value.thread.service_name),
      }
    : undefined;

  const replyWanted = isRecord(value.reply_wanted)
    ? {
        suffixes: getStringArray(value.reply_wanted.suffixes),
        patterns: getStringArray(value.reply_wanted.patterns),
        mode: getReplyMode(value.reply_wanted.mode),
        auto_reply: getBoolean(value.reply_wanted.auto_reply),
        max_auto_reply_count: getNonNegativeInteger(value.reply_wanted.max_auto_reply_count),
      }
    : undefined;

  const prompts = isRecord(value.prompts)
    ? {
        task_file: getString(value.prompts.task_file),
        common: getString(value.prompts.common),
        repository_dir: getString(value.prompts.repository_dir),
        approval_policy: getString(value.prompts.approval_policy),
        sandbox: getString(value.prompts.sandbox),
      }
    : undefined;

  return {
    verbose: getBoolean(value.verbose),
    codex,
    thread,
    reply_wanted: replyWanted,
    prompts,
  };
}

// ENOENTかどうかを判定して欠損設定を許容する。
function isFileMissing(err: unknown): boolean {
  return isRecord(err) && err.code === "ENOENT";
}

// 設定ファイルを読み込んでRunnerConfigを返す。
export async function loadRunnerConfig(configPath: string): Promise<RunnerConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = YAML.parse(raw) as unknown;
    return parseConfig(parsed);
  } catch (err) {
    if (isFileMissing(err)) {
      return {};
    }
    throw err;
  }
}
