import * as assert from "node:assert/strict";
import test from "node:test";
import { ReplyWantedDetector } from "../app/reply-wanted-detector.js";

test("ReplyWantedDetector returns true for default suffix and pattern", () => {
  const detector = new ReplyWantedDetector();

  assert.equal(detector.looksLikeReplyWanted("次はどうしますか?"), true);
  assert.equal(detector.looksLikeReplyWanted("次の項目を選んでください"), true);
  assert.equal(detector.looksLikeReplyWanted("処理を完了しました"), false);
});

test("ReplyWantedDetector merges custom suffixes and patterns", () => {
  const detector = new ReplyWantedDetector({
    suffixes: ["!"],
    patterns: ["NEED_REPLY"],
  });

  assert.equal(detector.looksLikeReplyWanted("ここで止める!"), true);
  assert.equal(detector.looksLikeReplyWanted("NEED_REPLY now"), true);
});
