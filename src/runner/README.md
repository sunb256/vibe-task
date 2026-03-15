
# runner(仮)

自動実行

```bash
cd src/runner
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
 # or
npx tsx src/run.ts -c config/config.yml
 # or
npx tsx src/run.ts --config config/config.yml
```

`config/config.yml` に `verbose` / `codex` / `thread` / `prompts` / `reply_wanted` を設定すると、
引数なし実行時の既定値を変更できます。

設定ファイルは引数で上書きできます。
- `-c <PATH>` / `--config <PATH>`
- `--config=<PATH>`

`prompts` では task 入力文の共通化と既定オプションを設定できます。
- `task_file`: 読み込む tasks ファイルパス
  - 相対パスは `run.ts` / `run.js` の実行スクリプト位置基準で解決
  - 例: `../../tasks/projects/vibe-task/action.yml`
- `common`: 各 `task.action` の前に自動で付与する共通指示文
- `repository_dir`: Codex 実行ディレクトリの既定値（相対指定は実行スクリプト位置基準で絶対化）
  - 旧キー `target_dir` も後方互換で読み取り可能（非推奨）
- `approval_policy`: 承認ポリシーの既定値
- `sandbox`: sandbox の既定値

既定値の優先順位は `taskごとの指定 > config/config.yml の prompts.* > tasks.yml の defaults(後方互換)` です。

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

ログ出力は自動で `logs/log.log` に保存されます（各行に日時を付与）。
- ローテート: `10MB` を超えたら世代を切り替え
- 保持世代: `log.log.1` 〜 `log.log.5`
