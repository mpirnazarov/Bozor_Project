"""Alembic o'rniga to'g'ridan migration."""
import os
import psycopg2

def run():
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    # is_vacant ustuni
    cur.execute("""
        ALTER TABLE shops 
        ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE
    """)
    print("Migration OK")
    conn.close()

if __name__ == "__main__":
    run()
