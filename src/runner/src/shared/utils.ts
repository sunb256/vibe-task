// 指定ミリ秒だけ待機するPromiseを返す。
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
