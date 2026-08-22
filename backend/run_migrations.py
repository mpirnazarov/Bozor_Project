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

    # Infra do'konlar
    cur.execute("""
        CREATE TABLE IF NOT EXISTS infra_shops (
            id SERIAL PRIMARY KEY,
            market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
            name VARCHAR(300) NOT NULL,
            contract_no VARCHAR(150),
            contract_date VARCHAR(20),
            monthly_rent NUMERIC(18,2) NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            water_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS infra_billing (
            id SERIAL PRIMARY KEY,
            shop_id INTEGER NOT NULL REFERENCES infra_shops(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            category VARCHAR(20) NOT NULL,
            due_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            CONSTRAINT uq_infra_billing UNIQUE (shop_id, year, month, category)
        )
    """)

    # 3 ta infra do'konni qo'shamiz (agar yo'q bo'lsa)
    cur.execute("SELECT COUNT(*) FROM infra_shops WHERE market_id = 1")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO infra_shops (market_id, name, contract_no, contract_date, monthly_rent)
            VALUES
              (1, 'ИПАК ЙУЛИ УРИКЗОР ФП', '26/2-ИНФ от 30.12.2025', '2025-12-30', 18674500),
              (1, 'ZAKOVAT SERVIS Mas''uliyati cheklangan jamiyati', '26/1-ИНФ от 30.12.2025', '2025-12-30', 22926540),
              (1, 'ATB O''ZSANOATQURILISHBANK Toshkent shahar mintaqaviy BXO', '26/3-ИНФ от 16.02.2026', '2026-02-16', 1637610)
        """)
        print("3 ta infra do'kon qo'shildi")

    cur.execute("ALTER TABLE infra_shops ADD COLUMN IF NOT EXISTS water_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS toilets (
            id SERIAL PRIMARY KEY,
            market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS toilet_revenues (
            id SERIAL PRIMARY KEY,
            toilet_id INTEGER NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
            revenue_date DATE NOT NULL,
            amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            CONSTRAINT uq_toilet_revenue_date UNIQUE (toilet_id, revenue_date)
        )
    """)
    cur.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS area NUMERIC(10,2)")
    print("Migrations OK")
    conn.close()

if __name__ == "__main__":
    run()

