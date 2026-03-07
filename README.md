
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

その後、ブラウザで http://127.0.0.1:5555

## Docker / docker-compose

```bash
docker compose up --build
```

- frontend: http://127.0.0.1:5555
- backend: http://127.0.0.1:5000
