import os, psycopg2

def run():
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    # alembic_version bo'sh bo'lsa 0019 ga set qilamiz
    cur.execute("INSERT INTO alembic_version (version_num) SELECT '0019' WHERE NOT EXISTS (SELECT 1 FROM alembic_version)")
    # is_vacant ustuni
    cur.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE")
    print("Migrations OK")
    conn.close()

if __name__ == "__main__":
    run()
