"""Alembic environment — sinxron psycopg2 bilan migration (oddiy va ishonchli)."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Barcha modellar shu yerda import qilinishi shart (autogenerate uchun).
import app.models  # noqa: F401

config = context.config


def _sync_url() -> str:
    """DATABASE_URL'ni sinxron psycopg2 drayveriga keltiradi.

    Alembic migration uchun async shart emas — psycopg2 (sync) ishlatamiz.
    Railway 'postgresql://', 'postgres://' yoki '+asyncpg' bersa ham to'g'rilaymiz.
    """
    url = settings.DATABASE_URL
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    # asyncpg yoki boshqa drayverni olib tashlab, sof postgresql qoldiramiz
    if url.startswith("postgresql+"):
        # masalan postgresql+asyncpg://...  -> postgresql://...
        rest = url.split("://", 1)[1]
        url = "postgresql://" + rest
    return url


config.set_main_option("sqlalchemy.url", _sync_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
