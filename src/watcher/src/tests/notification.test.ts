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
