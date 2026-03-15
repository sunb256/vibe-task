import * as assert from "node:assert/strict";
import test from "node:test";
import {
  handleNotificationMessage,
  type NotificationHandlerContext,
} from "../app/notification.js";

type ContextState = {
  activeTurnId: string | null;
  resolvedCount: number;
  lastAgentMessageText: string;
  streaming: Map<string, string>;
  streamingEndsWithNewline: Map<string, boolean>;
  progressMessages: string[];
  clearedProgressCount: number;
};

function createContext(isVerbose: boolean): {
  context: NotificationHandlerContext;
  state: ContextState;
} {
  const state: ContextState = {
    activeTurnId: "initial",
    resolvedCount: 0,
    lastAgentMessageText: "",
    streaming: new Map(),
    streamingEndsWithNewline: new Map(),
    progressMessages: [],
    clearedProgressCount: 0,
  };

  return {
    state,
    context: {
      isVerbose,
      setActiveTurnId: (turnId) => {
        state.activeTurnId = turnId;
      },
      resolveAndClearActiveTurn: () => {
        state.resolvedCount += 1;
      },
      setLastAgentMessageText: (text) => {
        state.lastAgentMessageText = text;
      },
      getStreamingAgentText: (itemId) => state.streaming.get(itemId) ?? "",
      setStreamingAgentText: (itemId, text) => {
        state.streaming.set(itemId, text);
      },
      deleteStreamingAgentText: (itemId) => {
        state.streaming.delete(itemId);
      },
      getStreamingDisplayEndsWithNewline: (itemId) =>
        state.streamingEndsWithNewline.get(itemId) ?? false,
      setStreamingDisplayEndsWithNewline: (itemId, value) => {
        state.streamingEndsWithNewline.set(itemId, value);
      },
      deleteStreamingDisplayEndsWithNewline: (itemId) => {
        state.streamingEndsWithNewline.delete(itemId);
      },
      setProgressMessage: (message) => {
        state.progressMessages.push(message);
      },
      clearProgressMessage: () => {
        state.clearedProgressCount += 1;
      },
    },
  };
}

async function captureConsoleLog(run: () => Promise<void>): Promise<string[]> {
  const original = console.log;
  const logs: string[] = [];

  console.log = ((...args: unknown[]) => {
    logs.push(args.map((v) => String(v)).join(" "));
  }) as typeof console.log;

  try {
    await run();
    return logs;
  } finally {
    console.log = original;
  }
}

async function captureStdoutWrite(run: () => Promise<void>): Promise<string> {
  const original = process.stdout.write;
  let output = "";

  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    output += String(chunk);
    if (typeof args[args.length - 1] === "function") {
      (args[args.length - 1] as () => void)();
    }
    return true;
  }) as typeof process.stdout.write;

  try {
    await run();
    return output;
  } finally {
    process.stdout.write = original;
  }
}

test("handleNotificationMessage logs event only in verbose mode", async () => {
  const quiet = createContext(false);
  const quietLogs = await captureConsoleLog(async () => {
    await handleNotificationMessage(
      { method: "thread/started", params: { thread: { id: "thread-1" } } },
      quiet.context
    );
  });
  assert.equal(quietLogs.length, 0);

  const verbose = createContext(true);
  const verboseLogs = await captureConsoleLog(async () => {
    await handleNotificationMessage(
      { method: "thread/started", params: { thread: { id: "thread-1" } } },
      verbose.context
    );
  });
  assert.equal(verboseLogs.length, 1);
  assert.match(verboseLogs[0] ?? "", /\[thread\.started\] thread-1/);
});

test("handleNotificationMessage records progress messages", async () => {
  const { context, state } = createContext(false);
  await handleNotificationMessage(
    { method: "turn/started", params: { turn: { id: "turn-1" } } },
    context
  );
  await handleNotificationMessage(
    {
      method: "item/started",
      params: { item: { id: "item-1", type: "agentMessage" } },
    },
    context
  );
  assert.equal(state.progressMessages[0], "processing task...");
  assert.equal(state.progressMessages[1], "streaming response...");
});

test("handleNotificationMessage updates state for turn completion", async () => {
  const { context, state } = createContext(false);

  await handleNotificationMessage(
    {
      method: "turn/completed",
      params: { turn: { id: "turn-1", status: "completed" } },
    },
    context
  );

  assert.equal(state.activeTurnId, null);
  assert.equal(state.resolvedCount, 1);
});

test("handleNotificationMessage stores and clears agent message text", async () => {
  const { context, state } = createContext(false);
  state.streaming.set("item-1", "streamed answer");

  await handleNotificationMessage(
    {
      method: "item/completed",
      params: {
        item: { id: "item-1", type: "agentMessage", status: "completed" },
      },
    },
    context
  );

  assert.equal(state.lastAgentMessageText, "streamed answer");
  assert.equal(state.streaming.has("item-1"), false);
});

test("handleNotificationMessage inserts line breaks after sentence punctuation on streaming output", async () => {
  const { context, state } = createContext(false);
  const output = await captureStdoutWrite(async () => {
    await handleNotificationMessage(
      {
        method: "item/agentMessage/delta",
        params: { itemId: "item-1", delta: "一文目です。二文目！三文目？four!five?\n次の行です。" },
      },
      context
    );
  });

  assert.equal(output, "一文目です。\n二文目！\n三文目？\nfour!\nfive?\n次の行です。\n");
  assert.equal(state.streaming.get("item-1"), "一文目です。二文目！三文目？four!five?\n次の行です。");
});

test("handleNotificationMessage adds extra blank line when agent streaming completes", async () => {
  const { context } = createContext(false);
  const output = await captureStdoutWrite(async () => {
    await handleNotificationMessage(
      {
        method: "item/agentMessage/delta",
        params: { itemId: "item-1", delta: "一文目です。二文目です。" },
      },
      context
    );
    await handleNotificationMessage(
      {
        method: "item/completed",
        params: { item: { id: "item-1", type: "agentMessage", status: "completed" } },
      },
      context
    );
  });

  assert.equal(output, "一文目です。\n二文目です。\n\n");
});
