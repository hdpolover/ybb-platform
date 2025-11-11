-- Install useful PostgreSQL extensions

\c ybb_db;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Full-text search support
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Advanced indexing
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

\echo 'Extensions installed successfully!'
