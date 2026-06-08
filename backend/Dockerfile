FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        postgresql-client \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

COPY . .

ENV PORT=8000
EXPOSE 8000

# Ishga tushganda: migration -> userlar -> SQLite data import (agar bor bo'lsa) -> server
CMD ["sh", "-c", "alembic upgrade head && python -m app.scripts.create_admin && python -m app.scripts.startup_seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
