import * as assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { JsonlTransport } from "../transport/jsonl-transport.js";

class FakeChildProcess extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();

  kill(): boolean {
    return true;
  }
}

function createFakeTransport() {
  const proc = new FakeChildProcess();
  const transport = new JsonlTransport(proc as unknown as ChildProcessWithoutNullStreams);
  return { proc, transport };
}

async function flushEvents(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

test("JsonlTransport suppresses known PATH update warning", async () => {
  const { proc, transport } = createFakeTransport();
  const captured: string[] = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  const stderr = process.stderr as unknown as {
    write: (chunk: string) => boolean;
  };

  stderr.write = ((chunk: string) => {
    captured.push(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    proc.stderr.write(
      "WARNING: proceeding, even though we could not update PATH: Permission denied (os error 13)\n"
    );
    proc.stderr.write("real error\n");
    await flushEvents();

    assert.deepEqual(captured, ["[codex stderr] real error\n"]);
  } finally {
    stderr.write = originalWrite as typeof process.stderr.write;
    transport.close();
  }
});

test("JsonlTransport flushes trailing stderr text on process exit", async () => {
  const { proc, transport } = createFakeTransport();
  const captured: string[] = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  const stderr = process.stderr as unknown as {
    write: (chunk: string) => boolean;
  };

  stderr.write = ((chunk: string) => {
    captured.push(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    proc.stderr.write("trailing error without newline");
    proc.emit("exit", 0, null);
    await flushEvents();

    assert.deepEqual(captured, ["[codex stderr] trailing error without newline"]);
  } finally {
    stderr.write = originalWrite as typeof process.stderr.write;
    transport.close();
  }
});
