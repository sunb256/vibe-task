FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir uv

COPY src/backend/pyproject.toml src/backend/uv.lock ./src/backend/
RUN cd src/backend && uv sync --frozen

COPY src/backend ./src/backend
COPY tasks ./tasks

EXPOSE 5000

WORKDIR /app/src/backend

CMD ["uv", "run", "flask", "--app", "main:app", "run", "--host", "0.0.0.0", "--port", "5000"]
