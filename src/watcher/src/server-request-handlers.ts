import type { JsonRpcId, JsonRpcRequest } from "./types.js";
import { isRecord } from "./types.js";

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function display(value: unknown, fallback: string): string {
  return value === undefined || value === null ? fallback : String(value);
}

type ApprovalArgs = {
  title: string;
  summary: string;
  reason?: unknown;
  choices: string[];
};

export type ServerRequestHandlerContext = {
  askApproval: (args: ApprovalArgs) => Promise<unknown>;
  normalizeAvailableDecisions: (available: unknown, fallback: string[]) => string[];
  askToolUserInput: (params: unknown) => Promise<unknown>;
  question: (query: string) => Promise<string>;
  respond: (id: JsonRpcId, result: unknown) => void;
  respondError: (id: JsonRpcId, code: number, message: string, data?: unknown) => void;
};

export async function handleServerRequestMessage(
  msg: JsonRpcRequest,
  context: ServerRequestHandlerContext
): Promise<void> {
  const { id, method, params } = msg;

  try {
    switch (method) {
      case "item/commandExecution/requestApproval": {
        const networkApprovalContext = getPath(params, "networkApprovalContext");
        const command = getPath(params, "command");
        const decision = await context.askApproval({
          title: "Command execution approval",
          reason: getPath(params, "reason"),
          summary: networkApprovalContext
            ? `network access to ${display(getPath(params, "networkApprovalContext", "host"), "unknown host")}`
            : Array.isArray(command)
              ? command.map((part) => String(part)).join(" ")
              : display(command, "(command unavailable)"),
          choices: context.normalizeAvailableDecisions(getPath(params, "availableDecisions"), [
            "accept",
            "acceptForSession",
            "decline",
            "cancel",
          ]),
        });

        context.respond(id, decision);
        return;
      }

      case "item/fileChange/requestApproval": {
        const grantRoot = getPath(params, "grantRoot");
        const decision = await context.askApproval({
          title: "File change approval",
          reason: getPath(params, "reason"),
          summary: `itemId=${display(getPath(params, "itemId"), "?")}${grantRoot ? ` grantRoot=${String(grantRoot)}` : ""}`,
          choices: context.normalizeAvailableDecisions(getPath(params, "availableDecisions"), [
            "accept",
            "acceptForSession",
            "decline",
            "cancel",
          ]),
        });

        context.respond(id, decision);
        return;
      }

      case "item/tool/requestUserInput": {
        const result = await context.askToolUserInput(params);
        context.respond(id, result);
        return;
      }

      case "item/tool/call": {
        console.log("[item/tool/call] Dynamic tool call received.");
        console.log(JSON.stringify(params, null, 2));

        const raw = await context.question(
          "Return tool result JSON (empty = decline with error): "
        );

        if (!raw.trim()) {
          context.respondError(id, -32000, "User declined dynamic tool call");
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          context.respondError(id, -32602, "Invalid JSON for dynamic tool result");
          return;
        }

        context.respond(id, parsed);
        return;
      }

      default: {
        console.log(`[server request] ${method}`);
        console.log(JSON.stringify(params, null, 2));

        const raw = await context.question(
          "Unknown server request. Paste JSON result to send back, or empty for {}: "
        );

        if (!raw.trim()) {
          context.respond(id, {});
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          context.respondError(id, -32602, "Invalid JSON");
          return;
        }

        context.respond(id, parsed);
        return;
      }
    }
  } catch (err) {
    context.respondError(id, -32000, err instanceof Error ? err.message : String(err));
  }
}
