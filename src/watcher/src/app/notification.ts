import type { JsonRpcNotification } from "../shared/types.js";
import { isRecord } from "../shared/types.js";

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

function extractAgentText(item: unknown): string {
  if (!item) return "";

  const itemRecord = getRecord(item);
  if (!itemRecord) return "";

  if (typeof itemRecord.text === "string") return itemRecord.text;
  if (typeof itemRecord.message === "string") return itemRecord.message;

  if (Array.isArray(itemRecord.content)) {
    return itemRecord.content
      .map((part) => {
        if (typeof part === "string") return part;
        const partRecord = getRecord(part);
        if (typeof partRecord?.text === "string") return partRecord.text;
        return "";
      })
      .join("");
  }

  return "";
}

export type NotificationHandlerContext = {
  setActiveTurnId: (turnId: string | null) => void;
  resolveAndClearActiveTurn: () => void;
  setLastAgentMessageText: (text: string) => void;
  getStreamingAgentText: (itemId: string) => string;
  setStreamingAgentText: (itemId: string, text: string) => void;
  deleteStreamingAgentText: (itemId: string) => void;
};

type NotificationHandler = (
  params: unknown,
  context: NotificationHandlerContext
) => Promise<void> | void;

const notificationHandlers: Record<string, NotificationHandler> = {
  "thread/started": (params) => {
    console.log(`[thread.started] ${display(getPath(params, "thread", "id"), "(unknown)")}`);
  },

  "turn/started": (params, context) => {
    console.log(`[turn.started] ${display(getPath(params, "turn", "id"), "(unknown)")}`);
    const maybeTurnId = getPath(params, "turn", "id");
    if (typeof maybeTurnId === "string") {
      context.setActiveTurnId(maybeTurnId);
    }
  },

  "item/started": (params, context) => {
    const item = getRecord(getPath(params, "item"));
    const type = display(item?.type, "unknown");
    console.log(`[item.started] type=${type} id=${display(item?.id, "?")}`);

    if (type === "agentMessage" && typeof item?.id === "string") {
      context.setStreamingAgentText(item.id, "");
    }

    if (type === "commandExecution") {
      const commandValue = item?.command;
      const command = Array.isArray(commandValue)
        ? commandValue.map((part) => String(part)).join(" ")
        : display(commandValue, "");
      if (command) console.log(`  command: ${command}`);
      if (item?.cwd) console.log(`  cwd: ${item.cwd}`);
    }
  },

  "item/agentMessage/delta": (params, context) => {
    const itemId = getPath(params, "itemId");
    const delta = getPath(params, "delta") ?? getPath(params, "text") ?? "";
    if (delta) {
      const deltaText = String(delta);
      process.stdout.write(deltaText);
      if (typeof itemId === "string") {
        const prev = context.getStreamingAgentText(itemId);
        context.setStreamingAgentText(itemId, prev + deltaText);
      }
    }
  },

  "item/reasoning/textDelta": () => {
    // raw reasoning は好みが分かれるのでデフォルトでは黙らせる
  },

  "item/commandExecution/outputDelta": (params) => {
    const chunk = getPath(params, "delta") ?? "";
    if (chunk) process.stdout.write(String(chunk));
  },

  "item/fileChange/outputDelta": () => {},

  "item/completed": (params, context) => {
    const item = getRecord(getPath(params, "item"));
    const type = display(item?.type, "unknown");
    console.log(`[item.completed] type=${type} status=${display(item?.status, "?")}`);

    if (type === "agentMessage") {
      const itemId = item?.id;
      const streamed =
        typeof itemId === "string" ? context.getStreamingAgentText(itemId) : "";
      const finalText = streamed || extractAgentText(item);

      context.setLastAgentMessageText(finalText.trim());

      if (typeof itemId === "string") {
        context.deleteStreamingAgentText(itemId);
      }
    }

    if (type === "fileChange" && Array.isArray(item?.changes)) {
      console.log(`[fileChange] ${item.changes.length} change(s)`);
    }
  },

  "serverRequest/resolved": (params) => {
    console.log(
      `[serverRequest.resolved] requestId=${display(getPath(params, "requestId"), "?")} threadId=${display(getPath(params, "threadId"), "?")}`
    );
  },

  "turn/completed": (params, context) => {
    const turn = getPath(params, "turn");
    console.log(
      `[turn.completed] id=${display(getPath(turn, "id"), "?")} status=${display(getPath(turn, "status"), "?")}`
    );
    if (getPath(turn, "error")) {
      console.error("[turn.error]", JSON.stringify(getPath(turn, "error"), null, 2));
    }

    context.setActiveTurnId(null);
    context.resolveAndClearActiveTurn();
  },

  error: (params) => {
    console.error("[app-server error event]", JSON.stringify(params, null, 2));
  },
};

export async function handleNotificationMessage(
  msg: JsonRpcNotification,
  context: NotificationHandlerContext
): Promise<void> {
  const handler = notificationHandlers[msg.method];
  if (!handler) {
    // 必要ならここを verbose にする
    // console.log("[notify]", msg.method, JSON.stringify(msg.params, null, 2));
    return;
  }

  await handler(msg.params, context);
}
