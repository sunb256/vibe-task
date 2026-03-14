
# watcher(仮)

自動実行

```bash
cd src/watcher
npx tsx src/run.ts
 # or
npx tsx src/run.ts tasks.yml
 # or
npx tsx src/run.ts tasks.yml --verbose
 # or
npx tsx src/run.ts tasks.yml --harfauto
 # or
npx tsx src/run.ts tasks.yml --fullauto
 # or
npx tsx src/run.ts tasks.yml -h
 # or
npx tsx src/run.ts tasks.yml -f
 # or
npx tsx src/run.ts tasks.yml -f --max-auto-reply-count 5
```

`config.yml` に `task_file` / `verbose` / `codex` / `thread` / `reply_wanted` を設定すると、
引数なし実行時の既定値を変更できます。

`verbose` を `true` にすると、`[thread.started]` / `[item.completed]` などのイベントログを表示します。
CLI の `--verbose` 指定がある場合は config より優先して有効になります。

`reply_wanted` は `continueConversationIfNeeded` の判定条件です。
- `suffixes`: 文末一致の追加ルール（既定: `?`, `？`）
- `patterns`: 正規表現パターン文字列の追加ルール（例: `答えて`, `番号で答えて`）
- `mode`: 返信待ち時の動作モード
  - `harfauto`: 質問時はユーザ入力を待つ（空Enterまたは `/skip` で次タスクへ進む）
  - `fullauto`: 質問時も `"続けてください"` を自動送信して継続
- `max_auto_reply_count`: `fullauto` 時の連続自動返信回数上限（既定: `3`）

モードは CLI 引数でも上書きできます。
- `-h` / `--harfauto`: ハーフオート
- `-f` / `--fullauto`: フルオート
- `-r <N>` / `--max-auto-reply-count <N>`: `fullauto` 時の連続自動返信回数上限
