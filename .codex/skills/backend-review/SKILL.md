---
name: "backend-review"
description: "Review changes in a Python + Flask backend codebase managed with uv. Use when the user asks for a code review, PR review, review comments, architecture review, or quality check for backend changes in this stack. 日本語: Python + Flask + uv の構成で、バックエンド変更のコードレビューや PR レビューを行うときに使う。"
---

# Backend Review Skill

## この skill を使う場面

Python + Flask + uv のバックエンド変更をレビューするときに使います。

例:

- 「このPRをレビューして」
- 「Flask 側の変更を見て」
- 「API の不具合になりそうな点を洗い出して」
- 「バリデーションや例外処理の観点でレビューして」
- 「DB / 認証 / セキュリティも含めて見て」
- 「uv 管理の依存関係変更も含めて見て」

## この skill を使わない場面

- frontend-only の変更
- infra-only の変更
- 実装そのものが目的で、レビューが目的ではないとき
- リポジトリが明らかに Python + Flask + uv ではないとき

## 目的

実際の diff と周辺コードに基づいて、**信頼できて実用的なレビュー**を返すこと。

特に次を重視します。

- correctness
- regression risk
- API contract の整合性
- validation / error handling
- security
- data integrity
- maintainability
- 依存関係や実行環境の整合性
- 性能や運用上の影響が大きい変更

逆に、次は重視しすぎません。

- 個人の好みに近い style 指摘
- formatter / linter が扱うだけの話
- 実害の薄い trivia
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
- API endpoint / service / model / repository への影響
- 影響を受ける shared utility / config / auth / middleware / schema
- `pyproject.toml`
- `uv.lock`
- 実行コマンドや開発用スクリプトの変更

そのうえで、内部的に次を整理します。

- 何が変わったか
- どの API や処理フローに影響するか
- どこが高リスクか
- 依存関係や実行環境に破綻がないか

### 2. repo の流儀を確認する

指摘する前に、repo の既存パターンを見ます。

- Flask app の構成
- route / blueprint の分け方
- request validation のやり方
- service / model / repository の責務分離
- error handling の統一方法
- auth / permission の実装パターン
- DB access / transaction の扱い
- test の書き方
- `uv run`, `uv sync`, `uv lock` 前提の運用方法
- dependency group や optional dependency の扱い

一般論よりも、**repo 内の一貫性**を優先します。  
ただし既存パターンが明確に危険なら、その点は指摘します。

### 3. 重点観点でレビューする

以下の観点を優先して確認します。

#### Correctness / API behavior

- endpoint の入力と出力が意図どおりか
- status code が適切か
- request parameter / body / query の扱いが正しいか
- optional / required 項目の整合性
- 既存 API contract を壊していないか
- 例外時に誤ったレスポンスを返していないか

#### Validation / Data handling

- request body の未検証利用
- 型やフォーマットの検証不足
- nullable / missing 値の扱い漏れ
- 想定外入力で 500 が出る分岐
- DB 保存前の正規化や検証漏れ
- サニタイズ不足

#### Security

- 認証 / 認可漏れ
- 別ユーザーのデータにアクセスできる可能性
- SQL injection の危険
- unsafe な raw query
- mass assignment 的な問題
- 秘密情報のログ出力
- stack trace や内部情報の漏洩
- CSRF / CORS / session / token まわりの不備
- ファイル upload / download の危険な扱い

#### Database / Transaction

- N+1 query
- transaction 不足による中途半端な更新
- rollback 考慮漏れ
- uniqueness / integrity 制約への考慮不足
- migration と実装の不整合
- 削除や更新の影響範囲の見落とし

#### Error handling / Observability

- 例外を握りつぶしていないか
- エラー時に適切な status / message を返しているか
- logging が不足または過剰でないか
- 運用で原因追跡しにくい実装になっていないか

#### Flask-specific

- application context / request context の誤用
- blueprint 登録漏れや route 競合
- `request`, `g`, `current_app` の unsafe な使い方
- decorator 順序の問題
- global state に依存しすぎていないか

#### uv / Packaging / Environment

- `pyproject.toml` の dependency 定義が実装と一致しているか
- `uv.lock` が依存変更に追従しているか
- 実行に必要なパッケージが default dependency / group dependency のどちらに置かれるべきか
- test / lint / dev 専用依存が本番依存に混ざっていないか
- スクリプトや README のコマンドが `uv run` 前提と整合しているか
- Python version 制約が追加依存と矛盾していないか
- lockfile 未更新により CI / local / production で差分が出ないか

#### Performance

大きな意味がある場合だけ指摘します。

- 無駄な DB query
- 一覧 API での過剰ロード
- pagination 不足
- 重い処理を request 内で同期実行している
- キャッシュ前提の破綻
- 大きなレスポンス生成の非効率

#### Maintainability

- route にロジックが寄りすぎている
- service / repository / model の責務が曖昧
- 重複した validation / error handling
- 条件分岐が増えすぎている
- 命名が曖昧
- refactor 後の dead code
- TODO だけ残っていて本番影響がある箇所
- dependency 管理ルールが変更で曖昧になっていないか

## ツール前提のルール

### Linter / Formatter

formatter や linter が扱うだけの指摘は繰り返しません。

たとえば次は原則レビューで言いません。

- import order だけの話
- quote style
- 空行や整形
- 機械的な formatting noise

ただし、lint が示す内容が実バグにつながるなら指摘します。

例:

- unused だと思っていた分岐が実はロジック破綻を示している
- broad exception が本来の失敗を隠している
- shadowing で違う値を見ている

### uv / Lockfile / Dependency change

依存関係の変更は、単に package 名が増減したかだけでなく、**実行環境に与える影響**として見ます。

たとえば次を確認します。

- `pyproject.toml` だけ更新されて `uv.lock` が追従していない
- 実装で使う依存が dev group のみに入っていて本番で import error になる
- transitive dependency 任せで直接依存を宣言していない
- バージョン制約が広すぎて互換性リスクが高い
- Flask 拡張や DB driver の更新で初期化コードと整合しない

## 指摘の強さ

指摘は次の粒度で整理します。

- High: バグ、セキュリティ問題、データ破損、重大な regression、merge blocker
- Medium: 修正したほうがよい correctness / API / maintainability / dependency 問題
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

- `user_id` を request body からそのまま受け取って更新対象を決めているため、認可チェックをすり抜けて他ユーザーのデータを更新できる可能性がある
- `pyproject.toml` に依存追加がある一方で `uv.lock` が更新されておらず、CI や本番環境で再現不能な dependency drift が起きる可能性がある

## 出力形式

### Summary
全体のリスクと merge readiness を 1〜3 文でまとめる。

### Findings
各指摘を次の形式で書く。

- Severity: High | Medium | Low | Nit
- Area: API | Validation | Security | Database | Error Handling | Flask | uv | Performance | Maintainability
- File: path
- Issue: 問題の要約
- Why it matters: 影響
- Recommendation: 修正案

### Positives
必要に応じて 1〜3 件、良い点を書く。

例:

- validation の境界が明確
- blueprint 構成が整理されている
- error handling が統一されている
- service 層の責務が分かりやすい
- `pyproject.toml` と `uv.lock` の更新が一貫している

### Merge recommendation
次のいずれかで締める。

- Ready to merge
- Ready after minor fixes
- Needs changes before merge

## この構成で特に気をつけること

### Flask

- route / blueprint の責務分離
- request / app context の使い方
- decorator の順序
- `jsonify` / response shape の一貫性
- app factory pattern を崩していないか

### Python

- broad `except Exception`
- mutable default argument
- import cycle を生みやすい構成変更
- 型ヒントがある場合の境界の曖昧さ
- truthy / falsy 判定で値を取り違えるケース

### uv

- `pyproject.toml` と `uv.lock` の整合性
- dependency group の誤配置
- Python version 制約との矛盾
- `uv run` 前提のコマンド整合性
- ローカルだけ動いて CI / 本番で壊れる依存追加
- lockfile 未更新や過剰更新によるレビュー難化

### Database

- query 回数
- transaction 境界
- migration とコードの整合性
- 削除 / 更新の副作用

## やらないこと

- 問題説明なしに全面リライトを提案しない
- 局所問題に対して大規模設計変更を求めない
- 根拠の薄い推測で指摘しない
- linter / formatter の結果をそのままレビュー価値として言い換えない
- 小さな指摘を大量に並べて重要点を埋もれさせない

## 最後の指示

簡潔に、技術的に正確に、重要度の高い問題から指摘すること。  
shipping risk と data/security risk を優先すること。  
加えて、dependency / lockfile / 実行環境の破綻リスクも優先すること。  
重大な問題がなければ、そのことをはっきり伝えること。
