FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs npm zsh bash git gh \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY src/backend/pyproject.toml src/backend/uv.lock ./src/backend/
RUN cd src/backend && uv sync --frozen

COPY src/runner/package.json src/runner/package-lock.json ./src/runner/
RUN cd src/runner && npm ci

COPY src/backend ./src/backend
COPY src/runner ./src/runner
COPY tasks ./tasks
RUN mkdir -p /app/src/runner/logs /app/logs \
  && chmod -R a+rwx /app/src/runner/logs /app/logs

EXPOSE 5000

WORKDIR /app/src/backend

CMD ["uv", "run", "flask", "--app", "main:app", "run", "--host", "0.0.0.0", "--port", "5000"]
