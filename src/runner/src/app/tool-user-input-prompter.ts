import { isRecord } from "../shared/types.js";

// unknown値をRecordへ安全に変換する。
function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

// ネストしたプロパティを順番に取り出す。
function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;

  for (const key of keys) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }

  return current;
}

type ToolUserInputPrompterOptions = {
  question: (query: string) => Promise<string>;
  clearProgressMessage: () => void;
  log?: (message: string) => void;
};

export class ToolUserInputPrompter {
  private readonly question: (query: string) => Promise<string>;
  private readonly clearProgressMessage: () => void;
  private readonly log: (message: string) => void;

  constructor(options: ToolUserInputPrompterOptions) {
    this.question = options.question;
    this.clearProgressMessage = options.clearProgressMessage;
    this.log = options.log ?? console.log;
  }

  // requestUserInput要求に対して対話入力で回答を作る。
  async askToolUserInput(params: unknown): Promise<unknown> {
    this.clearProgressMessage();
    this.log("\n=== Tool requested user input ===");
    this.log(JSON.stringify(params, null, 2));

    const questionsValue = getPath(params, "questions");
    const questions = Array.isArray(questionsValue) ? questionsValue : [];

    if (questions.length > 0) {
      const answers: unknown[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const title =
          getPath(q, "label") ??
          getPath(q, "title") ??
          getPath(q, "question") ??
          getPath(q, "prompt") ??
          `Question ${i + 1}`;

        this.log(`\nQ${i + 1}: ${String(title)}`);

        const optionsValue = getPath(q, "options");
        const options = Array.isArray(optionsValue) ? optionsValue : [];
        let hasOther = false;

        if (options.length > 0) {
          options.forEach((opt, idx) => {
            if (typeof opt === "string") {
              this.log(`  ${idx + 1}. ${opt}`);
            } else {
              const label = getPath(opt, "label") ?? getPath(opt, "title") ?? JSON.stringify(opt);
              this.log(`  ${idx + 1}. ${String(label)}`);
              if (getPath(opt, "isOther")) hasOther = true;
            }
          });

          this.log("  o. other (free text)");
        }

        const raw = (await this.question("> ")).trim();

        // 数字入力なら選択肢を返す
        const idx = Number(raw);

        if (raw && Number.isInteger(idx) && idx >= 1 && idx <= options.length) {
          const chosen = options[idx - 1];

          if (typeof chosen === "string") {
            answers.push(chosen);
          } else {
            answers.push(
              getPath(chosen, "value") ??
                getPath(chosen, "label") ??
                getPath(chosen, "title") ??
                chosen
            );
          }
          continue;
        }

        // "o" または自由入力を許す
        if (raw === "o" || raw === "other" || (!Number.isInteger(idx) && raw)) {
          // 相手が isOther を持っているなら素直に自由入力
          if (hasOther || options.length === 0) {
            const free =
              raw === "o" || raw === "other" ? await this.question("free text > ") : raw;
            answers.push(free);
            continue;
          }

          // isOther が無いなら、無理に通すかどうかを選ぶ
          this.log("This question may only accept listed options. Send raw free text anyway? [y/N]");

          const confirm = (await this.question("> ")).trim().toLowerCase();
          if (confirm === "y" || confirm === "yes") {
            answers.push(raw);
            continue;
          }

          throw new Error("User cancelled free-text response");
        }

        if (!raw) {
          answers.push("");
          continue;
        }

        throw new Error("Invalid input");
      }

      return { answers, response: answers };
    }

    const raw = await this.question(
      'Paste JSON result for requestUserInput (empty = {"answers": []}): '
    );

    if (!raw.trim()) {
      return { answers: [] };
    }

    return JSON.parse(raw) as unknown;
  }
}
