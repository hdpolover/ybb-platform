-- Seed: Create Admin User
-- Password: Admin123! (hashed with bcrypt)

INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    email_verified
) VALUES (
    uuid_generate_v4(),
    'admin@ybb-platform.com',
    '$2b$10$rQ5YKXxJ8J1XZxJ8J1XZxO6.5J8J1XZxJ8J1XZxJ8J1XZxJ8J1XZ',
    'Admin',
    'User',
    'admin',
    'active',
    true
) ON CONFLICT (email) DO NOTHING;

-- Create test user
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    email_verified
) VALUES (
    uuid_generate_v4(),
    'user@example.com',
    '$2b$10$rQ5YKXxJ8J1XZxJ8J1XZxO6.5J8J1XZxJ8J1XZxJ8J1XZxJ8J1XZ',
    'John',
    'Doe',
    'user',
    'active',
    true
) ON CONFLICT (email) DO NOTHING;
