import * as fs from "node:fs/promises";
import YAML from "yaml";
import type { WatcherConfig } from "../shared/types.js";
import { isRecord } from "../shared/types.js";

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((x) => typeof x !== "string")) {
    return undefined;
  }
  return [...value];
}

function parseConfig(value: unknown): WatcherConfig {
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
      }
    : undefined;

  return {
    task_file: getString(value.task_file),
    verbose: getBoolean(value.verbose),
    codex,
    thread,
    reply_wanted: replyWanted,
  };
}

function isFileMissing(err: unknown): boolean {
  return isRecord(err) && err.code === "ENOENT";
}

export async function loadWatcherConfig(configPath: string): Promise<WatcherConfig> {
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
