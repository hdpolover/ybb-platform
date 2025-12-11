-- Install useful PostgreSQL extensions for all databases
-- Updated: 2025-11-25

-- Main database (ybb_platform_db)
\c ybb_platform_db;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Full-text search support
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Advanced indexing
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

\echo 'Extensions for ybb_platform_db installed successfully!';

-- Payment database (ybb_payments_db)
\c ybb_payments_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\echo 'Extensions for ybb_payments_db installed successfully!';

-- File database (ybb_files_db)
\c ybb_files_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\echo 'Extensions for ybb_files_db installed successfully!'
