import { parse } from "yaml";

export type FrontMatterRow = {
  key: string;
  value: string;
};

export type ParsedFrontMatter = {
  body: string;
  rows: FrontMatterRow[];
};

type FrontMatterBlock = {
  text: string;
  body: string;
};

export function splitFrontMatter(content: string): ParsedFrontMatter {
  const block = readFrontMatterBlock(content);
  if (!block) {
    return { body: content, rows: [] };
  }
  const rows = parseRows(block.text);
  return { body: trimLeadingBlankLines(block.body), rows };
}

function readFrontMatterBlock(content: string): FrontMatterBlock | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  const end = lines.findIndex((line, index) => index > 0 && isTerminator(line));
  if (end < 0) {
    return null;
  }
  return {
    text: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

function isTerminator(line: string) {
  const trimmed = line.trim();
  return trimmed === "---" || trimmed === "...";
}

function parseRows(text: string): FrontMatterRow[] {
  if (!text.trim()) {
    return [];
  }
  try {
    const parsed = parse(text);
    return rowsFromValue(parsed);
  } catch {
    return [];
  }
}

function rowsFromValue(value: unknown): FrontMatterRow[] {
  if (!isRecord(value)) {
    return [];
  }
  return Object.entries(value).map(([key, item]) => ({
    key,
    value: formatValue(item),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (isRecord(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function trimLeadingBlankLines(value: string) {
  return value.replace(/^(?:\s*\r?\n)+/, "");
}
