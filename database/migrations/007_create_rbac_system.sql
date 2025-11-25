-- Migration: Create RBAC System
-- Created: 2025-11-11
-- Purpose: Role-Based Access Control system based on MySQL schema

-- Admin Roles Table
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE, -- Cannot be deleted if true
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    legacy_id INTEGER UNIQUE
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL, -- e.g., 'users', 'programs', 'applications'
    action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    legacy_id INTEGER UNIQUE,
    UNIQUE(resource, action)
);

-- Admin Role Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    legacy_id INTEGER UNIQUE,
    UNIQUE(role_id, permission_id)
);

-- Admins Table (extends users with admin-specific fields)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES admin_roles(id),
    employee_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT FALSE,
    can_assign_roles BOOLEAN DEFAULT FALSE,
    last_password_change TIMESTAMPTZ,
    password_expires_at TIMESTAMPTZ,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    legacy_id INTEGER UNIQUE
);

-- Admin Program Assignments (which programs an admin can manage)
CREATE TABLE IF NOT EXISTS admin_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES admins(id),
    legacy_id INTEGER UNIQUE,
    UNIQUE(admin_id, program_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON admin_roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON admin_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission ON admin_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_role_id ON admins(role_id);
CREATE INDEX IF NOT EXISTS idx_admins_deleted_at ON admins(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_programs_admin ON admin_programs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_programs_program ON admin_programs(program_id);

-- Create triggers
CREATE TRIGGER update_admin_roles_updated_at 
BEFORE UPDATE ON admin_roles 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
BEFORE UPDATE ON permissions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at 
BEFORE UPDATE ON admins 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO admin_roles (name, description, is_system_role) VALUES
    ('super_admin', 'Full system access', true),
    ('program_manager', 'Manage programs and applications', true),
    ('reviewer', 'Review and score applications', true),
    ('support', 'Handle support tickets and queries', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    -- Users
    ('users.create', 'Create new users', 'users', 'create'),
    ('users.read', 'View user information', 'users', 'read'),
    ('users.update', 'Update user information', 'users', 'update'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    -- Programs
    ('programs.create', 'Create new programs', 'programs', 'create'),
    ('programs.read', 'View programs', 'programs', 'read'),
    ('programs.update', 'Update programs', 'programs', 'update'),
    ('programs.delete', 'Delete programs', 'programs', 'delete'),
    ('programs.publish', 'Publish programs', 'programs', 'publish'),
    -- Applications
    ('applications.create', 'Create applications', 'applications', 'create'),
    ('applications.read', 'View applications', 'applications', 'read'),
    ('applications.update', 'Update applications', 'applications', 'update'),
    ('applications.delete', 'Delete applications', 'applications', 'delete'),
    ('applications.review', 'Review applications', 'applications', 'review'),
    ('applications.approve', 'Approve applications', 'applications', 'approve'),
    ('applications.reject', 'Reject applications', 'applications', 'reject'),
    -- Payments
    ('payments.read', 'View payments', 'payments', 'read'),
    ('payments.refund', 'Process refunds', 'payments', 'refund'),
    -- Admin
    ('admin.manage_roles', 'Manage admin roles', 'admin', 'manage_roles'),
    ('admin.assign_permissions', 'Assign permissions', 'admin', 'assign_permissions')
ON CONFLICT (resource, action) DO NOTHING;

-- Assign all permissions to super_admin role
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 
    r.id,
    p.id
FROM admin_roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE admin_roles IS 'Admin roles for RBAC system';
COMMENT ON TABLE permissions IS 'System permissions for fine-grained access control';
COMMENT ON TABLE admin_role_permissions IS 'Maps roles to permissions';
COMMENT ON TABLE admins IS 'Admin users with additional management capabilities';
COMMENT ON TABLE admin_programs IS 'Program assignments for admins';
