import * as assert from "node:assert/strict";
import test from "node:test";
import { parseApprovalDecisionInput } from "../app/client.js";

test("parseApprovalDecisionInput accepts numeric selection", () => {
  const choice = parseApprovalDecisionInput("1", [
    "accept",
    "acceptForSession",
    "decline",
    "cancel",
  ]);
  assert.equal(choice, "accept");
});

test("parseApprovalDecisionInput accepts direct choice text", () => {
  const choice = parseApprovalDecisionInput("decline", [
    "accept",
    "acceptForSession",
    "decline",
    "cancel",
  ]);
  assert.equal(choice, "decline");
});

test("parseApprovalDecisionInput parses execpolicy amendment", () => {
  const choice = parseApprovalDecisionInput(
    "acceptWithExecpolicyAmendment allow git push",
    ["acceptWithExecpolicyAmendment", "decline"]
  );
  assert.deepEqual(choice, {
    acceptWithExecpolicyAmendment: {
      execpolicy_amendment: ["allow", "git", "push"],
    },
  });
});

test("parseApprovalDecisionInput returns undefined on invalid input", () => {
  const choice = parseApprovalDecisionInput("x", [
    "accept",
    "acceptForSession",
    "decline",
    "cancel",
  ]);
  assert.equal(choice, undefined);
});
