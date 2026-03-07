# AGENTS.md

## 概要

このリポジトリは、Vite + React + TypeScript + React Router + ESLint + Prettier + Tailwind CSS で構成されたフロントエンドアプリと、
Python + Flask + uv で構成されたバックエンドで成り立つアプリです。

## 基本方針

- 変更は最小限に留める
- 既存の実装パターンを優先する
- 無関係なリファクタを混ぜない
- 実施していない検証を、実施済みと書かない
- frontend / backend いずれの変更でも、影響範囲を明示する
- 依存関係や実行環境の変更は、コード変更と同じくらい慎重に扱う


## 実装ルール

### Frontend

- React は関数コンポーネントと hooks を使う
- `any` や unsafe cast はできるだけ避ける
- route 変更時は links / params / navigation 影響を確認する
- Tailwind は既存の書き方に合わせる
- Prettier / ESLint が扱う整形だけの変更はしない

### Backend

- Flask の既存構成（app factory / blueprint / service / model / repository など）を崩さない
- route には処理を書きすぎず、既存の責務分離に合わせる
- request parameter / body / query は必要な検証を行う
- 例外処理は既存のエラーハンドリング方針に合わせる
- 認証 / 認可がある処理では、権限チェック漏れを避ける
- DB 更新では transaction / rollback / integrity 影響を意識する
- broad `except Exception` は必要最小限にする
- logging では秘密情報や過剰な内部情報を出力しない

### Python / uv

- Python の依存関係は `uv` 前提で扱う
- `pyproject.toml` を正とし、依存追加・更新時は `uv.lock` との整合性を保つ
- 実行・検証コマンドは可能な限り `uv run` を使う
- dev dependencies と runtime dependencies を混同しない
- lockfile の更新漏れや不要な差分を避ける

## 確認コマンド

### Frontend

```bash
npm run lint
npm run build
npm run test
```

- 利用中の package manager に合わせて `pnpm` または `yarn` を使う。

### Backend

```bash
uv run pytest
```

- lint / format / type check が導入されている場合は、repo の既存コマンドに従う
- 依存関係を更新した場合は、`pyproject.toml` と `uv.lock` の両方を確認する
- 開発サーバーや補助コマンドも、既存運用が `uv run` 前提ならそれに合わせる

## レビュー方法

- frontend の変更レビューでは `frontend-review` skill を使うこと
- backend の変更レビューでは、`backend-review` skill を使うこと


## 変更時の確認観点

### Frontend

- correctness
- type safety
- routing behavior
- accessibility
- maintainability

### Backend

- correctness
- API contract
- validation / error handling
- security
- database / transaction integrity
- maintainability
- dependency / lockfile consistency

## 注意事項

- frontend と backend の両方にまたがる変更では、片側だけ見て完了としない
- API の request / response shape を変える場合は、呼び出し側への影響も確認する
- config / env / dependency 変更は、ローカルだけでなく CI / 本番影響も意識する
- 問題説明なしに大規模な全面リファクタは提案しない
- formatter / linter の結果を、そのままレビュー価値として言い換えない
- ブランチはdevで作成し作業
- ユーザは`tasks/` 配下のファイルを編集することがある。この場合は同一コミットに含める
