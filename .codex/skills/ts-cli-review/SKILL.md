---
name: "ts-cli-review"
description: "Review changes in a TypeScript-based command line application or CLI tool. Use when the user asks for a code review, PR review, review comments, architecture review, or quality check for CLI changes in a TypeScript codebase. 日本語: TypeScript 製の command line application / CLI tool に対して、コードレビューや PR レビューを行うときに使う。"
---

# TypeScript CLI Review Skill

## この skill を使う場面

TypeScript ベースの command line application / CLI tool の変更をレビューするときに使います。

例:

- 「このPRをレビューして」
- 「CLI 側の変更を見て」
- 「引数処理や終了コードまわりを見て」
- 「型安全性やエラーハンドリング観点でレビューして」
- 「Node.js / fs / process / stdout / stderr の扱いも含めて見て」

## この skill を使わない場面

- frontend-only の変更
- infra-only の変更
- 実装そのものが目的で、レビューが目的ではないとき
- リポジトリが明らかに TypeScript CLI ではないとき

## 目的

実際の diff と周辺コードに基づいて、**信頼できて実用的なレビュー**を返すこと。

特に次を重視します。

- correctness
- regression risk
- type safety
- CLI UX
- argument / option parsing の正しさ
- exit code / error handling
- filesystem / process / environment との相互作用
- maintainability
- ユーザー影響のある performance

逆に、次は重視しすぎません。

- 個人の好みに近い style 指摘
- Prettier が扱う formatting
- 実害の薄い lint trivia
- 変更と関係の薄い大きな設計論

## 基本方針

- 推測ではなく、変更内容と周辺コードに根ざして指摘する
- repo の既存ルールや実装パターンを尊重する
- 細かい指摘を大量に出すより、重要な問題を少数・明確に出す
- 指摘には「何が問題か」「なぜ問題か」「どう直すべきか」を含める
- 大きな問題がなければ、問題なしと明確に伝える

## 進め方

### 1. 変更範囲を把握する

まず次を確認します。

- changed files
- その周辺コード
- CLI entrypoint への影響
- command / subcommand / option / argument 定義への影響
- 影響を受ける shared utility / parser / formatter / type
- process / filesystem / network / child process の利用箇所

そのうえで、内部的に次を整理します。

- 何が変わったか
- どのコマンドやユースケースに影響するか
- どこが高リスクか

### 2. repo の流儀を確認する

指摘する前に、repo の既存パターンを見ます。

- entrypoint 構成
- command routing パターン
- argument parsing パターン
- config 読み込みの扱い
- logging / output / error message の扱い
- stdout / stderr の使い分け
- exit code の設計
- fs / path / env の扱い
- naming / typing の慣習
- test があればその書き方

一般論よりも、**repo 内の一貫性**を優先します。  
ただし既存パターンが明確に危険なら、その点は指摘します。

### 3. 重点観点でレビューする

以下の観点を優先して確認します。

#### CLI correctness

- 引数 / option / flag の解釈ミス
- required / optional の取り違え
- default 値の不整合
- command / subcommand の分岐漏れ
- help 表示と実挙動のズレ
- 想定外入力でのクラッシュ
- sync / async の扱いミス
- 例外がトップレベルまで漏れて process が落ちる問題
- 部分成功時の扱い不整合
- idempotency が期待される処理の破綻

#### TypeScript safety

- `any` や unsafe cast
- nullable 値の unsafe な利用
- parse 後の値を未検証で使っている箇所
- JSON / config / API response shape の未検証利用
- `process.env` を string 前提で過信している箇所
- 型が広すぎて保証が弱い箇所
- command 間での option 型のズレ
- discriminated union を使うべき分岐が曖昧なままになっている箇所

#### Command / Argument handling

- positional arguments の順序依存ミス
- short option / long option の衝突
- boolean / string / number の parse ミス
- repeatable option の扱い漏れ
- unknown option の扱いが不親切または危険
- help / usage / examples の更新漏れ
- breaking change なのに互換性ケアがない変更
- shell からの利用を考えた安定した出力形式の破綻

#### Node.js / Process

- `process.exit()` の早すぎる呼び出し
- `stdout` / `stderr` の誤用
- signal handling の不足
- unhandled rejection / uncaught exception の放置
- stream の close / flush 漏れ
- child process の exit status 未確認
- path resolution の OS 依存バグ
- CWD 前提の危険な実装

#### Filesystem / Environment

- 相対パス前提で壊れやすい実装
- ファイル上書き時の安全性不足
- atomicity が必要な更新の破綻
- existence check と利用の race
- 権限エラーや not found の考慮不足
- 環境変数不足時のメッセージ不備
- `.env` や config fallback の順序不整合
- ユーザー入力を path / command に使う箇所の危険性

#### Error handling / UX

- エラー時に原因が分からない message
- recoverable error なのに stack trace をそのまま出す問題
- user-facing error と debug 情報の分離不足
- exit code が常に 0 / 1 で粗すぎる問題
- 成功時出力と失敗時出力の一貫性不足
- quiet / verbose / json 出力モードの破綻
- 進捗表示や spinner が非TTY環境で壊れる問題

#### Async / State

- 複数ファイル処理の途中失敗で状態が壊れる問題
- 並列実行時の race condition
- async loop の書き方ミス
- mutation 後の rollback 不足
- retry / timeout / cancellation の考慮不足
- source of truth の重複
- cache / temp file の cleanup 漏れ

#### Performance

大きな意味がある場合だけ指摘します。

- 大量ファイル処理での不要な全件読み込み
- sync I/O の多用で CLI が不必要に遅い問題
- 毎回の重い JSON parse / glob / scan
- 不要な child process 起動
- streaming 可能なのに buffer に全読み込みしている箇所
- 大規模入力でメモリ消費が過大になる処理

#### Maintainability

- command 実装ごとのロジック重複
- parser / validator / executor の責務分離不足
- option schema と runtime 挙動の乖離
- テストしにくい `process`, `fs`, `Date.now`, `cwd` 直参照
- 意味が曖昧な naming
- refactor 後の dead code
- entrypoint にロジックが集中しすぎている構成

## ツール前提のルール

### ESLint

ESLint が処理する機械的な指摘は繰り返しません。

たとえば次は原則レビューで言いません。

- import order だけの話
- quote style
- semicolon
- formatting noise

ただし、lint が示す内容が実バグにつながるなら指摘します。

例:

- 到達不能分岐が示すロジック不備
- shadowing による値の取り違え
- Promise の未処理が実行時不具合につながるケース

### Prettier

Prettier が扱う formatting 指摘はしません。

## 指摘の強さ

指摘は次の粒度で整理します。

- High: バグ、重大な regression、危険な data loss、重大な CLI UX / scripting breakage、merge blocker
- Medium: 修正したほうがよい correctness / UX / maintainability 問題
- Low: 改善価値はあるが、通常は blocking ではない
- Nit: 任意の軽い指摘。多用しない

**量よりも重要度**を優先します。

## 指摘の条件

指摘するときは必ず、少なくとも次を含めます。

- どの file / code area か
- 何が問題か
- なぜ問題か
- どう直すべきか

避ける表現:

- “This might be cleaner.”
- “Consider refactoring.”

望ましい表現:

- `--output` が省略された場合に `undefined` をそのまま `path.resolve()` に渡しており、実行環境によっては意図しない出力先に解決される可能性がある`
- `エラー時にも exit code 0 のまま終了するため、CI や shell script から失敗を検知できない`

## 出力形式

### Summary
全体のリスクと merge readiness を 1〜3 文でまとめる。

### Findings
各指摘を次の形式で書く。

- Severity: High | Medium | Low | Nit
- Area: CLI | TypeScript | Command/Args | Node/Process | Filesystem/Env | Error Handling/UX | Async/State | Performance | Maintainability
- File: path
- Issue: 問題の要約
- Why it matters: 影響
- Recommendation: 修正案

### Positives
必要に応じて 1〜3 件、良い点を書く。

例:

- option schema と実行ロジックの境界が明確
- stdout / stderr の使い分けが整理されている
- エラーメッセージが利用者目線で分かりやすい
- fs アクセスが抽象化されていて test しやすい

### Merge recommendation
次のいずれかで締める。

- Ready to merge
- Ready after minor fixes
- Needs changes before merge

## この構成で特に気をつけること

### TypeScript

- props ではなく command input 契約の明確さ
- parse 後 / I/O 後の安全な narrowing
- external input に対する型境界の明確さ

### Node.js CLI

- `process.argv` / parser library の扱い
- `process.exitCode` と `process.exit()` の使い分け
- `stdout` / `stderr` / TTY 判定
- CWD / absolute path / relative path の解決
- cross-platform な path / shell 前提の扱い

### Config / Environment

小さい option 追加でも既存 script や CI に影響しやすいので、互換性を end-to-end で考えます。

### Output contract

CLI の出力は人だけでなく script からも消費される可能性があるため、文言やフォーマット変更の影響を慎重に見ます。

## やらないこと

- 問題説明なしに全面リライトを提案しない
- 局所問題に対して大規模設計変更を求めない
- 根拠の薄い推測で指摘しない
- lint / prettier の結果をそのままレビュー価値として言い換えない
- 小さな指摘を大量に並べて重要点を埋もれさせない

## 最後の指示

簡潔に、技術的に正確に、重要度の高い問題から指摘すること。  
shipping risk を優先すること。  
重大な問題がなければ、そのことをはっきり伝えること。