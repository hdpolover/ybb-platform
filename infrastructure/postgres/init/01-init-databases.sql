-- Initialize YBB Platform Databases
-- Updated: 2025-11-25 - Microservices architecture

-- Create extensions in postgres database first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create main database (API service)
SELECT 'CREATE DATABASE ybb_platform'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_platform')\gexec

-- Create payment service database
SELECT 'CREATE DATABASE ybb_payments_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_payments_db')\gexec

-- Create file service database
SELECT 'CREATE DATABASE ybb_files_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_files_db')\gexec

-- Setup main database (API Service - Prisma)
\c ybb_platform;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'Main database (ybb_platform) initialized successfully!';

-- Setup payment service database (GORM)
\c ybb_payments_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'Payment database (ybb_payments_db) initialized successfully!';

-- Setup file service database (SQLAlchemy)
\c ybb_files_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'File database (ybb_files_db) initialized successfully!';
