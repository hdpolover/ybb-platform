-- Initialize YBB Platform Databases

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create main database (API service)
SELECT 'CREATE DATABASE ybb_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_db')\gexec

-- Create payment service database
SELECT 'CREATE DATABASE ybb_payments_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_payments_db')\gexec

-- Setup main database
\c ybb_db;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'Main database (ybb_db) initialized successfully!';

-- Setup payment service database
\c ybb_payments_db;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'Payment database (ybb_payments_db) initialized successfully!';
