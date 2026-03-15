import type { JsonRpcNotification } from "../shared/types.js";
import { isRecord } from "../shared/types.js";

// unknown値をRecordへ安全に変換する。
function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

// ネストした値をキー列でたどって取得する。
function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;

  for (const key of keys) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

// 表示用にunknown値を文字列へ変換する。
function display(value: unknown, fallback: string): string {
  return value === undefined || value === null ? fallback : String(value);
}

// 表示時のみ文末記号で改行して読みやすさを保つ。
function formatAgentDeltaForDisplay(text: string): string {
  return text.replace(/([。！？!?])(?!\n)/g, "$1\n");
}

// agentMessage由来の本文テキストを抽出する。
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
  isVerbose: boolean;
  setActiveTurnId: (turnId: string | null) => void;
  resolveAndClearActiveTurn: () => void;
  setLastAgentMessageText: (text: string) => void;
  getStreamingAgentText: (itemId: string) => string;
  setStreamingAgentText: (itemId: string, text: string) => void;
  deleteStreamingAgentText: (itemId: string) => void;
  getStreamingDisplayEndsWithNewline: (itemId: string) => boolean;
  setStreamingDisplayEndsWithNewline: (itemId: string, value: boolean) => void;
  deleteStreamingDisplayEndsWithNewline: (itemId: string) => void;
  setProgressMessage: (message: string) => void;
  clearProgressMessage: () => void;
};

type NotificationHandler = (
  params: unknown,
  context: NotificationHandlerContext
) => Promise<void> | void;

// verbose設定時だけログを標準出力へ出す。
function logVerbose(context: NotificationHandlerContext, message: string): void {
  if (!context.isVerbose) return;
  console.log(message);
}

// item type から進行状況ラベルを決定する。
function getProgressMessage(type: string): string | undefined {
  if (type === "reasoning") return "thinking...";
  if (type === "agentMessage") return "streaming response...";
  if (type === "commandExecution") return "running command...";
  if (type === "fileChange") return "applying file changes...";
  if (type === "mcpToolCall") return "calling tool...";
  if (type === "webSearch") return "searching web...";
  return undefined;
}

const notificationHandlers: Record<string, NotificationHandler> = {
  // スレッド開始通知をログ出力する。
  "thread/started": (params, context) => {
    logVerbose(
      context,
      `[thread.started] ${display(getPath(params, "thread", "id"), "(unknown)")}`
    );
  },

  // turn開始通知をログ出力しアクティブturnを更新する。
  "turn/started": (params, context) => {
    logVerbose(
      context,
      `[turn.started] ${display(getPath(params, "turn", "id"), "(unknown)")}`
    );
    context.setProgressMessage("processing task...");
    
    const maybeTurnId = getPath(params, "turn", "id");
    if (typeof maybeTurnId === "string") {
      context.setActiveTurnId(maybeTurnId);
    }
  },

  // item開始通知をログ出力し必要な初期化を行う。
  "item/started": (params, context) => {

    const item = getRecord(getPath(params, "item"));
    const type = display(item?.type, "unknown");
    
    logVerbose(context, `[item.started] type=${type} id=${display(item?.id, "?")}`);
    const progress = getProgressMessage(type);
    if (progress) {
      context.setProgressMessage(progress);
    }

    if (type === "agentMessage" && typeof item?.id === "string") {
      context.setStreamingAgentText(item.id, "");
      context.setStreamingDisplayEndsWithNewline(item.id, false);
    }

    if (type === "commandExecution") {
      const commandValue = item?.command;
      const command = Array.isArray(commandValue)
                      ? commandValue.map((part) => String(part)).join(" ")
                      : display(commandValue, "");

      if (command) logVerbose(context, `  command: ${command}`);
      if (item?.cwd) logVerbose(context, `  cwd: ${item.cwd}`);
    }
  },

  // agentMessageの差分を逐次表示しバッファへ保持する。
  "item/agentMessage/delta": (params, context) => {
    const itemId = getPath(params, "itemId");
    const delta = getPath(params, "delta") ?? getPath(params, "text") ?? "";

    if (delta) {
      const deltaText = String(delta);
      
      // 読みやすさのため、適宜改行をする
      const displayText = formatAgentDeltaForDisplay(deltaText);
      context.clearProgressMessage();
      process.stdout.write(displayText);
      
      if (typeof itemId === "string") {
        const prev = context.getStreamingAgentText(itemId);
        context.setStreamingAgentText(itemId, prev + deltaText);
        context.setStreamingDisplayEndsWithNewline(itemId, displayText.endsWith("\n"));
      }
    }
  },

  // reasoningテキスト差分は現在は表示しない。
  "item/reasoning/textDelta": () => {
    // raw reasoning は好みが分かれるのでデフォルトでは黙らせる
  },

  // コマンド出力差分をそのまま標準出力へ流す。
  "item/commandExecution/outputDelta": (params, context) => {
    const chunk = getPath(params, "delta") ?? "";
    if (chunk) {
      context.clearProgressMessage();
      process.stdout.write(String(chunk));
    }
  },

  // fileChange差分は現状表示せず無視する。
  "item/fileChange/outputDelta": () => {},

  // item完了通知を処理し最終メッセージを確定する。
  "item/completed": (params, context) => {

    const item = getRecord(getPath(params, "item"));
    const type = display(item?.type, "unknown");

    logVerbose(context, `[item.completed] type=${type} status=${display(item?.status, "?")}`);

    if (type === "agentMessage") {

      const itemId = item?.id;
      const streamed = typeof itemId === "string" ? context.getStreamingAgentText(itemId) : "";
      const finalText = streamed || extractAgentText(item);

      context.setLastAgentMessageText(finalText.trim());

      if (typeof itemId === "string") {
        if (streamed) {
          const endsWithNewline = context.getStreamingDisplayEndsWithNewline(itemId);
          context.clearProgressMessage();
          process.stdout.write(endsWithNewline ? "\n" : "\n\n");
        }
        context.deleteStreamingAgentText(itemId);
        context.deleteStreamingDisplayEndsWithNewline(itemId);
      }
    }

    if (type === "fileChange" && Array.isArray(item?.changes)) {
      logVerbose(context, `[fileChange] ${item.changes.length} change(s)`);
    }
  },

  // サーバー要求完了通知をverbose時のみ表示する。
  "serverRequest/resolved": (params, context) => {
    logVerbose(
      context,
      `[serverRequest.resolved] requestId=${display(getPath(params, "requestId"), "?")} threadId=${display(getPath(params, "threadId"), "?")}`
    );
  },

  // turn完了通知を処理して待機中turnを解放する。
  "turn/completed": (params, context) => {
    const turn = getPath(params, "turn");
    logVerbose(
      context,
      `[turn.completed] id=${display(getPath(turn, "id"), "?")} status=${display(getPath(turn, "status"), "?")}`
    );
    context.clearProgressMessage();

    if (getPath(turn, "error")) {
      console.error("[turn.error]", JSON.stringify(getPath(turn, "error"), null, 2));
    }

    context.setActiveTurnId(null);
    context.resolveAndClearActiveTurn();
  },

  // app-serverのエラー通知を標準エラーへ出力する。
  error: (params) => {
    console.error("[app-server error event]", JSON.stringify(params, null, 2));
  },
};

// 通知メソッドに対応するハンドラを呼び出す。
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
