---
name: "frontend-review"
description: "Review changes in a Vite + React + TypeScript + React Router + ESLint + Prettier + Tailwind codebase. Use when the user asks for a code review, PR review, review comments, architecture review, or quality check for frontend changes in this stack. 日本語: Vite + React + TypeScript + React Router + ESLint + Prettier + Tailwind の構成で、フロントエンド変更のコードレビューや PR レビューを行うときに使う。"
---

# Frontend Review Skill

## この skill を使う場面

Vite + React + TypeScript + React Router + ESLint + Prettier + Tailwind の構成で、フロントエンド変更をレビューするときに使います。

例:

- 「このPRをレビューして」
- 「React 側の変更を見て」
- 「不具合になりそうな点を洗い出して」
- 「型安全性やルーティング観点でレビューして」
- 「lint / Tailwind / a11y も含めて見て」

## この skill を使わない場面

- backend-only の変更
- infra-only の変更
- 実装そのものが目的で、レビューが目的ではないとき
- リポジトリが明らかにこの構成ではないとき

## 目的

実際の diff と周辺コードに基づいて、**信頼できて実用的なレビュー**を返すこと。

特に次を重視します。

- correctness
- regression risk
- type safety
- routing behavior
- state / effect の正しさ
- accessibility
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
- route 定義や navigation への影響
- 影響を受ける shared component / hook / utility / type

そのうえで、内部的に次を整理します。

- 何が変わったか
- どの画面や機能に影響するか
- どこが高リスクか

### 2. repo の流儀を確認する

指摘する前に、repo の既存パターンを見ます。

- file / component 構成
- routing パターン
- data fetching パターン
- loading / error / empty state の扱い
- Tailwind の書き方
- naming / typing の慣習
- test があればその書き方

一般論よりも、**repo 内の一貫性**を優先します。  
ただし既存パターンが明確に危険なら、その点は指摘します。

### 3. 重点観点でレビューする

以下の観点を優先して確認します。

#### React correctness

- `useEffect` / `useMemo` / `useCallback` の依存関係
- stale closure
- 不要な state / derived state
- props / state の不整合
- list の key 問題
- render 中の副作用
- null / undefined で落ちる分岐
- effect の cleanup 漏れ
- async 重複実行や race condition

#### TypeScript safety

- `any` や unsafe cast
- nullable 値の unsafe な利用
- route params / search params の過信
- API response shape の未検証利用
- 型が広すぎて保証が弱い箇所
- component / hook 間の型のズレ

#### React Router

- route nesting の破綻
- relative / absolute navigation の誤り
- path 変更に伴うリンク切れ
- route params 名変更の取りこぼし
- redirect loop
- unauthorized content の一瞬表示
- error boundary / 404 想定漏れ

#### UI / Tailwind

- responsive 崩れ
- class の競合
- overflow / truncation / layout 崩れ
- 見た目だけボタンっぽい `div`
- hover / focus / disabled state の不足
- Tailwind の重複で意図が見えにくい箇所

#### Accessibility

- button / link の使い分けミス
- icon-only control のラベル不足
- form label の不足
- keyboard 操作不能な UI
- focus 表示不足
- 状態変化が支援技術に伝わらない箇所

#### Async / State

- loading / error / empty state の不足
- optimistic update の失敗時考慮不足
- source of truth の重複
- route change 時の state リセット漏れ
- mutation 後に UI が更新されない問題
- error を握りつぶしている箇所

#### Performance

大きな意味がある場合だけ指摘します。

- 不要な rerender
- 毎 render の重い計算
- unstable な object / function props
- context 更新範囲が広すぎるケース
- route-level lazy loading の崩れ

#### Maintainability

- ロジック重複
- 責務過多な component
- route / view / utility の密結合
- 拡張しづらい条件分岐
- 意味が曖昧な naming
- refactor 後の dead code

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

- hook dependencies の不整合
- shadowing による値の取り違え
- 到達不能分岐が示すロジック不備

### Prettier

Prettier が扱う formatting 指摘はしません。

### Tailwind

class が長いだけでは抽象化を求めません。  
ただし、同じ UI パターンが繰り返されて保守性を落としている場合は指摘します。

## 指摘の強さ

指摘は次の粒度で整理します。

- High: バグ、重大な regression、重大な a11y 問題、merge blocker
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

- ``useEffect` が `projectId` を読んでいるのに依存配列に含まれていないため、route 変更時に stale data を表示する可能性がある`

## 出力形式

### Summary
全体のリスクと merge readiness を 1〜3 文でまとめる。

### Findings
各指摘を次の形式で書く。

- Severity: High | Medium | Low | Nit
- Area: React | TypeScript | Router | Tailwind/UI | Accessibility | Async/State | Performance | Maintainability
- File: path
- Issue: 問題の要約
- Why it matters: 影響
- Recommendation: 修正案

### Positives
必要に応じて 1〜3 件、良い点を書く。

例:

- 型の境界が明確
- route 構成が整理されている
- loading / error handling が丁寧
- component 分割が自然

### Merge recommendation
次のいずれかで締める。

- Ready to merge
- Ready after minor fixes
- Needs changes before merge

## この構成で特に気をつけること

### Vite

- `import.meta.env` の使い方
- asset import の破綻
- browser 前提コードの混入
- lazy import の解決ミス

### React + TypeScript

- props 契約の明確さ
- async 境界での安全な narrowing
- route-aware な typing

### React Router

小さい path 変更でも影響が広がりやすいので、遷移導線を end-to-end で考えます。

### Tailwind

repo の既存パターンとの一貫性を優先し、見た目の好みではなく、保守性や UX に影響する点を中心に見ます。

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
