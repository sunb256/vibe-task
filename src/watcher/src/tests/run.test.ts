import * as assert from "node:assert/strict";
import test from "node:test";
import { formatCompletedAt } from "../run.js";

test("formatCompletedAt formats datetime", () => {
  const value = formatCompletedAt(new Date(2026, 2, 14, 9, 5, 7));
  assert.equal(value, "2026-03-14 09:05:07");
});
