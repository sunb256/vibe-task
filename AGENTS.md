# AGENTS.md

## 概要

リポジトリ構成
- Frontend: Vite + React + TypeScript + React Router + ESLint + Prettier + Tailwind CSS 
- Backend: Python + Flask + uv
- Watcher: TypeScript + codex sdk

## 基本方針

- 変更は最小限に留める
- 既存の実装パターンを優先する
- 影響範囲を明示する
- 作業中に新しい未コミット変更を検知した場合は含める


## 実装ルール

### Frontend

- React は関数コンポーネントと hooks を使う
- `any` や unsafe cast はできるだけ避ける
- route 変更時は links / params / navigation 影響を確認する
- Tailwind は既存の書き方に合わせる


### Backend

- Flask の既存構成（app factory / blueprint / service / model / repository など）を崩さない
- 例外処理は既存のエラーハンドリング方針に合わせる
- logging では秘密情報や過剰な内部情報を出力しない


### Watcher

 - 可読性重視
 - コンポーネント化


### Python / uv

- Python は `uv` を使用
- 実行・検証コマンドは `uv run` を使う

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

### Watcher

今はなし


## レビュー方法

- frontend の変更レビューでは `frontend-review` skill を使うこと
- backend の変更レビューでは、`backend-review` skill を使うこと
- watcher の変更レビューでは、`ts-cli-review` skill を使うこと


## 注意事項

- frontend と backend の両方にまたがる変更では、片側だけ見て完了としない
- API の request / response shape を変える場合は、呼び出し側への影響も確認する
- gitのブランチは `dev` がなければ作成して `dev` で作業
- ユーザは`tasks/` 配下のファイルを編集することがある。この場合は同一コミットに含める(質問不要)
