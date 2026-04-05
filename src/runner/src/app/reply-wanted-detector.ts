export type ReplyWantedConfig = {
  suffixes?: string[];
  patterns?: string[];
};

const DEFAULT_REPLY_SUFFIXES = ["?", "？"];
const DEFAULT_REPLY_PATTERNS = [
  "答えて",
  "回答は",
  "入力して",
  "選んで",
  "番号で答えて",
  "指定して",
  "教えて",
  "A/B/C",
  "1/2/3",
  "どうぞ",
];

// 既定ルールと設定ルールを重複なく統合する。
function mergeRules(value: string[] | undefined, fallback: string[]): string[] {
  const merged = [...fallback, ...(value ?? [])];
  return [...new Set(merged.map((rule) => rule.trim()).filter((rule) => rule.length > 0))];
}

// 返信判定パターン配列から正規表現を組み立てる。
function createReplyPattern(patterns: string[]): RegExp | null {
  if (patterns.length === 0) {
    return null;
  }

  try {
    return new RegExp(patterns.join("|"));
  } catch {
    return null;
  }
}

export class ReplyWantedDetector {
  private readonly replySuffixes: string[];
  private readonly replyPattern: RegExp | null;

  constructor(config?: ReplyWantedConfig) {
    this.replySuffixes = mergeRules(config?.suffixes, DEFAULT_REPLY_SUFFIXES);
    this.replyPattern = createReplyPattern(
      mergeRules(config?.patterns, DEFAULT_REPLY_PATTERNS)
    );
  }

  // 最終メッセージが返信要求かどうかを判定する。
  looksLikeReplyWanted(text: string): boolean {
    const trimmedText = text.trim();

    if (!trimmedText) return false;

    if (this.replySuffixes.some((suffix) => trimmedText.endsWith(suffix))) {
      return true;
    }

    return this.replyPattern?.test(trimmedText) ?? false;
  }
}
