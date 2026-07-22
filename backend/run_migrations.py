import os, psycopg2

def run():
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute("INSERT INTO alembic_version (version_num) SELECT '0019' WHERE NOT EXISTS (SELECT 1 FROM alembic_version)")
    cur.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE")
    cur.execute("ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS address TEXT")
    cur.execute("ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50)")
    cur.execute("ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS place_type VARCHAR(100)")
    cur.execute("ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS purpose VARCHAR(200)")
    print("Migrations OK")
    conn.close()

if __name__ == "__main__":
    run()
