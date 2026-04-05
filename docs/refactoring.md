# Refactoring候補一覧

このドキュメントは、`src/` 配下の実装を確認して「構造改善の効果が高い箇所」を優先度付きでまとめたものです。

## 優先度サマリ

| 優先度 | 対象 | 主な課題 |
| --- | --- | --- |
| High | `src/frontend/src/features/tasks/ProjectTasksPage.tsx` | 1ファイルに状態管理・ポーリング・CRUD・UIが集中 |
| High | `src/runner/src/run.ts` | CLI解析〜実行ループ〜履歴書き込みまで `main` に集中 |
| High | `src/runner/src/app/client.ts` | 通知処理・承認UI・requestUserInput・自動返信判定が1クラスに集中 |
| Medium | `src/backend/app/routes/api.py` | payload検証とservice生成の重複、単一Blueprint肥大化 |
| Medium | `src/backend/app/repositories/task_repository.py` | YAML I/Oとドメインロジックと正規化処理の責務混在 |
| Medium | `ProjectListPage` / `SkillsPage` / `ProjectDocsPanel` / `ProjectTasksPage` | 検索バー+一覧状態表示のUI/ロジック重複 |
| Medium | `src/frontend/src/features/skills/SkillsPage.tsx` | 新規作成だけ `window.prompt`、編集はDialogでUX/実装が不統一 |
| Low | `src/frontend/src/features/tasks/ProjectTasksPage.test.tsx` | テストヘルパー未抽出で重複が多く保守コストが高い |
| Low | prompts API一式（backend） | frontendから削除済み機能の残存コードが多い（要件確認） |

---

## 1. ProjectTasksPageの責務分離（High）

- 対象:
  - `src/frontend/src/features/tasks/ProjectTasksPage.tsx:46`
  - `src/frontend/src/features/tasks/ProjectTasksPage.tsx:77`
  - `src/frontend/src/features/tasks/ProjectTasksPage.tsx:204`
  - `src/frontend/src/features/tasks/ProjectTasksPage.tsx:446`
- 問題:
  - 1200行超の中で、データ取得・キャッシュ反映・Runnerログポーリング・ショートカット・CRUD・レンダリングを同時に扱っている。
  - 変更時の影響範囲が読み取りにくく、回帰の温床になりやすい。
- リファクタリング案:
  - `useProjectTasksData`（取得/更新/キャッシュ）
  - `useRunnerPolling`（Runnerログ/状態同期）
  - `useTaskDialogs`（create/edit状態遷移）
  - `TaskTabPanel` / `RunnerTabPanel` / `DocsTabPanel` へUI分離
- 期待効果:
  - 機能追加時の差分を局所化しやすくなり、テスト対象も分割できる。

## 2. Runner起動フローの分割（High）

- 対象:
  - `src/runner/src/run.ts:90`
  - `src/runner/src/run.ts:394`
- 問題:
  - `main()` が CLI解釈、project選択、task実行、履歴書き込み、エラーハンドリングまで担当している。
  - 失敗時の経路（`--task` 指定/未指定、選択UIあり/なし）が追いづらい。
- リファクタリング案:
  - `cli/args.ts`（引数解析）
  - `runtime/selection.ts`（project選択/解決）
  - `runtime/executor.ts`（task実行ループ）
  - `runtime/history.ts`（完了/失敗履歴）
- 期待効果:
  - 実行フロー単位でのテストと保守が容易になる。

## 3. CodexAppServerClientの分割（High）

- 対象:
  - `src/runner/src/app/client.ts:124`
  - `src/runner/src/app/client.ts:427`
  - `src/runner/src/app/client.ts:550`
- 問題:
  - 1クラス内で、RPC制御、承認入力UI、requestUserInput解釈、自動返信判定まで実装している。
  - `askToolUserInput()` が長く、入力仕様変更時の影響が広い。
- リファクタリング案:
  - `ToolUserInputPrompter`（質問/選択肢入力）
  - `ApprovalPrompter`（承認系）
  - `ReplyWantedDetector`（suffix/pattern判定）
  - `CodexSessionClient`（純粋にthread/turn操作）
- 期待効果:
  - 役割ごとの単体テストを追加しやすくなる。

## 4. Flask APIルートの整理（Medium）

- 対象:
  - `src/backend/app/routes/api.py:20`
  - `src/backend/app/routes/api.py:309`
- 問題:
  - `request.get_json` の検証や `service = ...` の重複が多い。
  - Projects/Tasks/Runner/Docs/Skills/Promptsが単一ファイルに集中している。
- リファクタリング案:
  - `routes/projects.py`, `routes/tasks.py` など機能別Blueprintへ分割
  - `require_json_object()`, `require_str_field()` 等の共通バリデータ導入
- 期待効果:
  - エンドポイント追加時の重複を削減し、誤差分を減らせる。

## 5. TaskRepositoryの責務分解（Medium）

- 対象:
  - `src/backend/app/repositories/task_repository.py:34`
  - `src/backend/app/repositories/task_repository.py:223`
  - `src/backend/app/repositories/task_repository.py:358`
- 問題:
  - YAML読み書き、プレースホルダ正規化、task CRUD、history解釈、ID採番が同一クラスに混在。
  - 異常系が `AppError("task file is invalid", 400)` に集約され、原因切り分けしにくい。
- リファクタリング案:
  - `TaskYamlStore`（I/Oとparse）
  - `TaskMutator`（create/update/move/swap）
  - `RunnerHistoryParser`（history検証）
  - `TaskIdAllocator`（採番）
- 期待効果:
  - 仕様変更時の影響範囲を縮小し、失敗原因の特定を速くできる。

## 6. 検索+一覧UIの共通化（Medium）

- 対象:
  - `src/frontend/src/features/projects/ProjectListPage.tsx:216`
  - `src/frontend/src/features/skills/SkillsPage.tsx:146`
  - `src/frontend/src/features/tasks/ProjectDocsPanel.tsx:109`
  - `src/frontend/src/features/tasks/ProjectTasksPage.tsx:459`
- 問題:
  - 検索入力、`Loading/Empty/No-match` 表示、同系統カードUIの実装が重複している。
- リファクタリング案:
  - `SearchInput` コンポーネント
  - `ListStateNotice` コンポーネント
  - 共通フィルタユーティリティ（`normalizeQuery` など）
- 期待効果:
  - デザイン変更やa11y改善を1箇所で反映できる。

## 7. Skillsの作成/編集UX統一（Medium）

- 対象:
  - `src/frontend/src/features/skills/SkillsPage.tsx:76`
  - `src/frontend/src/features/skills/SkillsPage.tsx:265`
- 問題:
  - 新規作成のみ `window.prompt`、編集は `NewTaskDialog` で実装パターンが分かれている。
  - バリデーションやエラー表示の設計が分散。
- リファクタリング案:
  - 新規作成もDialog化し、編集と同じフォーム・エラーハンドリングに統一
- 期待効果:
  - ユーザー体験と状態管理を一貫化できる。

## 8. ProjectTasksPageテストの共通化（Low）

- 対象:
  - `src/frontend/src/features/tasks/ProjectTasksPage.test.tsx:107`
  - `src/frontend/src/features/tasks/ProjectTasksPage.test.tsx:692`
  - `src/frontend/src/features/tasks/ProjectTasksPage.test.tsx:736`
- 問題:
  - `fetchProjects` / `fetchTasks` のモックと `MemoryRouter` 描画が多数のテストで重複。
  - 失敗時に本質以外（セットアップ差異）で壊れやすい。
- リファクタリング案:
  - `renderProjectTasksPage()` ヘルパー
  - `mockProject()` / `mockTask()` fixture factory
- 期待効果:
  - テストの可読性向上とメンテナンス工数削減。

## 9. prompts API残存コードの整理（Low, 要件確認）

- 対象:
  - `src/backend/app/routes/api.py:194`
  - `src/backend/app/services/prompt_service.py:1`
  - `src/backend/app/repositories/prompt_repository.py:1`
  - `src/backend/tests/test_prompts_api.py:1`
- 問題:
  - frontendから `Custom Prompt` 機能を撤去後も、backend APIとテストは残っている。
- リファクタリング案:
  - 要件として本当に廃止なら、prompts APIを段階的に削除
  - 廃止しないなら、利用者（runner等）を明示して責務を再定義
- 期待効果:
  - 不要保守コストの削減、機能境界の明確化。
