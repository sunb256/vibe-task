import * as fs from "node:fs/promises";
import * as path from "node:path";

type RotatingLogOptions = {
  filePath: string;
  maxBytes: number;
  maxFiles: number;
};

// 出力チャンクをログ保存用の文字列へ変換する。
function toText(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  return String(chunk);
}

// 存在する場合のみファイルサイズを返す。
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

// ファイルが存在する場合のみリネームする。
async function renameIfExists(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

// ローテート世代を繰り上げて現在ログを退避する。
async function rotateFiles(filePath: string, maxFiles: number): Promise<void> {
  await fs.rm(`${filePath}.${maxFiles}`, { force: true });
  for (let i = maxFiles - 1; i >= 1; i -= 1) {
    await renameIfExists(`${filePath}.${i}`, `${filePath}.${i + 1}`);
  }
  await renameIfExists(filePath, `${filePath}.1`);
}

// 追記前に閾値を確認して必要ならローテートする。
async function appendWithRotate(options: RotatingLogOptions, text: string): Promise<void> {
  await fs.mkdir(path.dirname(options.filePath), { recursive: true });
  const currentSize = await getFileSize(options.filePath);
  const appendSize = Buffer.byteLength(text, "utf8");
  if (currentSize + appendSize > options.maxBytes) {
    await rotateFiles(options.filePath, options.maxFiles);
  }
  await fs.appendFile(options.filePath, text, "utf8");
}

// 標準出力と標準エラーをローテートログへ複製する。
export function setupRotatingLog(options: RotatingLogOptions): void {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  let writeQueue = Promise.resolve();
  let warned = false;

  const enqueue = (chunk: unknown): void => {
    const text = toText(chunk);
    writeQueue = writeQueue
      .then(async () => {
        await appendWithRotate(options, text);
      })
      .catch((err: unknown) => {
        if (warned) return;
        warned = true;
        originalStderr(`[watcher log] failed to write log: ${String(err)}\n`);
      });
  };

  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    enqueue(chunk);
    return (originalStdout as (...args: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    enqueue(chunk);
    return (originalStderr as (...args: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
}

// テスト用途でローテート追記処理を直接実行する。
export async function appendWithRotateForTest(
  options: RotatingLogOptions,
  text: string
): Promise<void> {
  await appendWithRotate(options, text);
}
