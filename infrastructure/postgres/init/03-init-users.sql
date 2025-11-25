-- Create database users with appropriate permissions

-- Main database permissions
\c ybb_db;

GRANT ALL PRIVILEGES ON DATABASE ybb_db TO ybb_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ybb_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ybb_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ybb_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ybb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ybb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ybb_user;

\echo 'Main database permissions configured successfully!';

-- Payment database permissions
\c ybb_payments_db;

GRANT ALL PRIVILEGES ON DATABASE ybb_payments_db TO ybb_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ybb_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ybb_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ybb_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ybb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ybb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ybb_user;

\echo 'Payment database permissions configured successfully!';
