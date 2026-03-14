import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { appendWithRotateForTest } from "../shared/rotating-log.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-log-test-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("appendWithRotateForTest rotates and keeps max files", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "log.log");
    const options = { filePath, maxBytes: 10, maxFiles: 2 };

    await appendWithRotateForTest(options, "first\n");
    await appendWithRotateForTest(options, "second\n");
    await appendWithRotateForTest(options, "third\n");

    const current = await fs.readFile(filePath, "utf8");
    const first = await fs.readFile(`${filePath}.1`, "utf8");
    const second = await fs.readFile(`${filePath}.2`, "utf8");

    assert.equal(current, "third\n");
    assert.equal(first, "second\n");
    assert.equal(second, "first\n");
  });
});
