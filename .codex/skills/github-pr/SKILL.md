---
name: "github-pr"
description: "Create a pull request for a GitHub repository using GitHub CLI. Use when the user asks to open a PR, prepare a PR, write a PR title/body from the current branch. 日本語: GitHub リポジトリで PR を作成するときに使う。現在のブランチの差分を確認し、PR タイトル/本文を作成する。"
---

# GitHub PR Skill

## この skill を使う場面

GitHub リポジトリで、現在のブランチから Pull Request を作るときに使います。

例:

- 「この変更でPRを作って」
- 「PR本文を書いて」
- 「draft PR を作って」
- 「差分を見て PR タイトルと本文を整えて」

## この skill を使わない場面

- コードレビューだけをしたいとき
- commit だけしたいとき
- GitHub 以外のリポジトリのとき
- まだ PR にする単位まで変更がまとまっていないとき

## 目的

実際の diff と commit に基づいて、**正確でレビューしやすい PR** を作ること。

特に次を守ります。

- 差分にないことを書かない
- 実行していない検証を、実行済みと書かない
- タイトルを曖昧にしない
- 必要なら draft PR にする

## 前提

次を前提に進めます。

- `git` が使える
- `gh` がインストールされている
- `gh` が認証済みである
- カレントディレクトリが GitHub リポジトリである
- 現在のブランチが PR 対象である

満たせない場合は、何が不足しているかを短く伝え、必要な次のコマンドを示します。

## 進め方

### 1. 状態確認

まず次を確認します。

- current branch
- default base branch
- working tree の状態
- 直近 commit
- base branch との差分
- branch が push 済みか

コマンド例:

```bash
git status --short
git branch --show-current
git symbolic-ref refs/remotes/origin/HEAD
git log --oneline --decorate -n 10
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
````

`main` 以外が default branch なら実際の branch を使います。

### 2. 変更内容の整理

diff と commit を見て、次を整理します。

* 何を変えたか
* 何のための変更か
* ユーザー影響があるか
* draft にすべきか
* PR タイトルの主語は何か

推測ではなく、差分から読み取れる内容だけを使います。

### 3. PR テンプレート確認

次のような PR template があれば優先して従います。

* `.github/pull_request_template.md`
* `.github/PULL_REQUEST_TEMPLATE.md`
* `.github/pull_request_template/`

なければこの skill の標準フォーマットを使います。

### 4. 検証

可能なら repo の標準的な確認コマンドを実行します。

例:

```bash
npm run lint
npm run build
npm run test
```

または `pnpm` / `yarn` に合わせます。


未実施なら、PR本文に未実施と明記します。

### 5. PR タイトル作成

タイトルは次を満たすようにします。

* 短い
* 具体的
* 変更内容が一目で分かる
* repo の既存スタイルと大きくズレない

例:

* `Add loading state to project detail page`
* `Fix stale search params in user list route`
* `Refactor header navigation into shared component`

避ける:

* `fix`
* `update`
* `changes`
* `misc`

Conventional Commits 風の運用ならそれに合わせます。
必ず日本語で書くこと


### 6. PR 本文作成

テンプレートがない場合は、基本的に次を使います。

```md
## Summary
- ...
- ...

## Changes
- ...
- ...
- ...

## Testing
- [x] npm run lint
- [ ] npm run test (not run)

## Notes
- ...
```

ルール:

* 事実ベースで書く
* 差分にないことは書かない
* route / UI / shared component の変更は明記する
* 制約や follow-up があれば `Notes` に書く

### 7. draft かどうか判定

次なら draft を優先します。

* 実装が未完了
* 検証不足
* 既知課題が残っている
* ユーザーが draft を希望している

それ以外でレビュー可能なら通常 PR にします。

### 8. `gh` で PR 作成

通常 PR:

```bash
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "your pr title" \
  --body-file .git/.pr-body.md
```

draft PR:

```bash
gh pr create \
  --draft \
  --base main \
  --head "$(git branch --show-current)" \
  --title "your pr title" \
  --body-file .git/.pr-body.md
```



## PR を作らないほうがいいケース

次のときは無理に PR を作りません。

* base branch に対して差分がない
* 変更のまとまりがなく PR 単位として不自然
* 検証が失敗しており、draft にする意図もない
* `gh` が使えない
* GitHub repo として扱えない

その場合は blocker を短く説明します。

## 出力形式

### PR Plan

* base branch
* current branch
* draft / ready-for-review
* validation status

### Proposed Title

```text
...
```

### Proposed Body

```md
...
```

### Execution

* 実行した `gh pr create` コマンド
* または blocker

### Result

* 作成された PR URL
* または失敗理由

## 最後の指示

差分に忠実で、簡潔で、レビューしやすい PR を作ること。
やっていない確認を、やったことにしないこと。
タイトルと本文は、変更の実態に合わせて具体的に書くこと。
