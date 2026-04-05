
# Vibe Task

Vibe Agentic Coding Task Management System


## Environment

 - VSCode
 - codex
 - git
 - ghq


## Run

backend:

```bash
cd ./src/backend
uv run flask --app main:app run --debug
```

frontend:

```bash
cd ./src/frontend
npm install
npm run dev
```
-> http://127.0.0.1:5555

- `repositoryPath` examples
  - recommended: `~/ghq/github.com/...`
  - Unix/macOS: `$HOME/ghq/github.com/...`
  - Windows native: `$HOME\\ghq\\github.com\\...` or `C:\\Users\\<user>\\ghq\\github.com\\...`


runner:

```bash
cd ./src/runner
npm install
npm run start
```

## Docker / docker-compose

```bash
cp .env.local .env
# -> edit port, UID, GID, proxy ...

mkdir -p src/frontend/.node_modules_container
docker compose up --build -d
```

- backend: http://127.0.0.1:5000
- frontend: http://127.0.0.1:5555
- frontend は起動時にコンテナ内で `npm ci` を実行します（Mac/Linux 差分の依存を分離）
- frontend の依存が壊れた場合:

```bash
rm -rf src/frontend/.node_modules_container
docker compose up --build -d
```

- bind mount
  - `tasks/projects.yml`:  
  - `${HOME}/.codex/prompts`
    - Custom Prompt (`*.md`)
  - `${HOME}/ghq`
    - `repositoryPath`
      - `$HOME/ghq/github.com/...` 
      - `$HOME/ghq/gitlab.com/...` 


## Misc

### Design

 - [icons - Lucide](https://lucide.dev/)
 - [font - SolidLinker](https://hicchicc.github.io/00ff/)
