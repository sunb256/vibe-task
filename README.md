
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


## Docker / docker-compose

```bash
cp .env.local .env
docker compose up --build -d
```

- backend: http://127.0.0.1:5000
- frontend: http://127.0.0.1:5555
- bind mount
  - `tasks/projects.yml`:  
  - `${HOME}/ghq`
    - `repositoryPath`
      - `$HOME/ghq/github.com/...` 
      - `$HOME/ghq/gitlab.com/...` 
