
# Vibe Task

Vibe Agentic Coding Management System


## 実行

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
docker compose up --build -d
```

- frontend: http://127.0.0.1:5555
- backend: http://127.0.0.1:5000
- bind mount
  - `tasks/projects.yml`:  
  - `${HOME}/ghq`
    - `repositoryPath`
      - `$HOME/ghq/github.com/...` 
      - `$HOME/ghq/gitlab.com/...` 
