import * as assert from "node:assert/strict";
import test from "node:test";
import { handleServerRequestMessage } from "../app/request.js";

function createContext(decision: unknown) {
  let responded: { id: string | number; result: unknown } | null = null;
  let errored: { id: string | number; code: number; message: string } | null = null;

  return {
    get responded() {
      return responded;
    },
    get errored() {
      return errored;
    },
    context: {
      askApproval: async () => decision,
      normalizeAvailableDecisions: (available: unknown, fallback: string[]) =>
        Array.isArray(available) ? (available as string[]) : fallback,
      askToolUserInput: async () => ({}),
      question: async () => "",
      respond: (id: string | number, result: unknown) => {
        responded = { id, result };
      },
      respondError: (id: string | number, code: number, message: string) => {
        errored = { id, code, message };
      },
    },
  };
}

test("handleServerRequestMessage wraps command approval decision in response object", async () => {
  const testContext = createContext("accept");

  await handleServerRequestMessage(
    {
      id: 1,
      method: "item/commandExecution/requestApproval",
      params: {
        command: ["git", "push", "origin", "dev"],
        availableDecisions: ["accept", "acceptForSession", "decline", "cancel"],
      },
    },
    testContext.context
  );

  assert.equal(testContext.errored, null);
  assert.deepEqual(testContext.responded, { id: 1, result: { decision: "accept" } });
});

test("handleServerRequestMessage wraps file change approval decision in response object", async () => {
  const testContext = createContext("decline");

  await handleServerRequestMessage(
    {
      id: 2,
      method: "item/fileChange/requestApproval",
      params: {
        itemId: "item-1",
        availableDecisions: ["accept", "acceptForSession", "decline", "cancel"],
      },
    },
    testContext.context
  );

  assert.equal(testContext.errored, null);
  assert.deepEqual(testContext.responded, { id: 2, result: { decision: "decline" } });
});

test("handleServerRequestMessage keeps amendment decision payload under decision", async () => {
  const decision = {
    acceptWithExecpolicyAmendment: {
      execpolicy_amendment: ["allow", "git", "push"],
    },
  };
  const testContext = createContext(decision);

  await handleServerRequestMessage(
    {
      id: 3,
      method: "item/commandExecution/requestApproval",
      params: {
        command: ["git", "push", "origin", "dev"],
        availableDecisions: ["acceptWithExecpolicyAmendment", "decline"],
      },
    },
    testContext.context
  );

  assert.equal(testContext.errored, null);
  assert.deepEqual(testContext.responded, { id: 3, result: { decision } });
});
