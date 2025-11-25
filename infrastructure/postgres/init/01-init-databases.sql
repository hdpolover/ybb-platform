-- Initialize YBB Platform Database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create main database (if not exists)
SELECT 'CREATE DATABASE ybb_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ybb_db')\gexec

-- Connect to the database
\c ybb_db;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

\echo 'Database initialization completed successfully!'
