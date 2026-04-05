export type ApprovalDecision =
  | string
  | {
      acceptWithExecpolicyAmendment: {
        execpolicy_amendment: string[];
      };
    };

type ApprovalArgs = {
  title: string;
  summary: string;
  reason?: unknown;
  choices: string[];
};

type ApprovalPrompterOptions = {
  question: (query: string) => Promise<string>;
  clearProgressMessage: () => void;
  log?: (message: string) => void;
};

// 承認入力を choice 文字列または補助入力から決定値へ変換する。
export function parseApprovalDecisionInput(
  input: string,
  choices: string[]
): ApprovalDecision | undefined {
  const answer = input.trim();
  if (!answer) {
    return undefined;
  }

  const index = Number(answer);
  if (Number.isInteger(index) && index >= 1 && index <= choices.length) {
    return choices[index - 1];
  }

  if (choices.includes(answer)) {
    return answer;
  }

  if (answer.startsWith("acceptWithExecpolicyAmendment ")) {
    const rest = answer.slice("acceptWithExecpolicyAmendment ".length).trim();
    const amendment = rest ? rest.split(/\s+/) : [];
    return {
      acceptWithExecpolicyAmendment: {
        execpolicy_amendment: amendment,
      },
    };
  }

  return undefined;
}

export class ApprovalPrompter {
  private readonly question: (query: string) => Promise<string>;
  private readonly clearProgressMessage: () => void;
  private readonly log: (message: string) => void;

  constructor(options: ApprovalPrompterOptions) {
    this.question = options.question;
    this.clearProgressMessage = options.clearProgressMessage;
    this.log = options.log ?? console.log;
  }

  // 承認リクエストを対話入力で処理する。
  async askApproval(args: ApprovalArgs): Promise<ApprovalDecision> {
    this.clearProgressMessage();

    this.log(`\n=== ${args.title} ===`);
    this.log(`summary: ${args.summary}`);

    if (args.reason) {
      this.log(`reason: ${String(args.reason)}`);
    }

    this.log(`choices: ${args.choices.join(", ")}`);
    args.choices.forEach((choice, idx) => {
      this.log(`  ${idx + 1}. ${choice}`);
    });

    if (args.choices.includes("acceptForSession")) {
      this.log("  tip: セッション中の確認を減らす場合は 2 (acceptForSession)");
    }

    while (true) {
      const input = (
        await this.question(`decision [1-${args.choices.length} or ${args.choices.join("/")}] > `)
      ).trim();

      const decision = parseApprovalDecisionInput(input, args.choices);
      if (decision !== undefined) {
        return decision;
      }

      this.log("invalid decision");
    }
  }
}
