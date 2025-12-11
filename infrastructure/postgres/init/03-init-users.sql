-- Create database users with appropriate permissions
-- Updated: 2025-11-25 - All three databases

-- Main database permissions (ybb_platform_db)
\c ybb_platform_db;

GRANT ALL PRIVILEGES ON DATABASE ybb_platform_db TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ybb_prod_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ybb_prod_user;

\echo 'Main database (ybb_platform_db) permissions configured!';

-- Payment database permissions (ybb_payments_db)
\c ybb_payments_db;

GRANT ALL PRIVILEGES ON DATABASE ybb_payments_db TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ybb_prod_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ybb_prod_user;

\echo 'Payment database (ybb_payments_db) permissions configured!';

-- File database permissions (ybb_files_db)
\c ybb_files_db;

GRANT ALL PRIVILEGES ON DATABASE ybb_files_db TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ybb_prod_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ybb_prod_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ybb_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ybb_prod_user;

\echo 'File database (ybb_files_db) permissions configured!';
