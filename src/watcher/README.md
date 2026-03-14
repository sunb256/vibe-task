
# watcher(仮)

自動実行

```bash
cd src/watcher
npx tsx src/run.ts
 # or
npx tsx src/run.ts tasks.yml
```

`config.yml` に `task_file` / `codex` / `thread` / `reply_wanted` を設定すると、
引数なし実行時の既定値を変更できます。

`reply_wanted` は `continueConversationIfNeeded` の判定条件です。
- `suffixes`: 文末一致の追加ルール（既定: `?`, `？`）
- `patterns`: 正規表現パターン文字列の追加ルール（例: `答えて`, `番号で答えて`）
