const pool = require('../config/database');

// Tables that have a created_by column for row-level access
const OWNED_TABLES = [
  'workflows', 'documents', 'approvals', 'automation_tasks', 'invoices',
  'contracts', 'tickets', 'onboarding', 'expenses', 'meetings', 'reports',
  'data_entries', 'compliance', 'vendors', 'process_mining',
  'workflow_optimizations', 'rpa_scripts', 'automation_exceptions', 'roi_calculations'
];

// Fields to strip from responses for non-admin users
const SENSITIVE_FIELDS = {
  users: ['password', 'reset_token', 'reset_token_expires']
};

// Require a specific role (or higher)
const ROLE_HIERARCHY = { user: 1, manager: 2, admin: 3 };

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Row-level access: admin/manager can access all, users only own records
const checkRowAccess = (tableName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Admin and manager can access everything
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      return next();
    }
    // For tables with created_by, check ownership
    if (OWNED_TABLES.includes(tableName) && req.params.id) {
      try {
        const result = await pool.query(
          `SELECT created_by FROM ${tableName} WHERE id = $1`,
          [req.params.id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        if (result.rows[0].created_by !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } catch (error) {
        return next(error);
      }
    }
    next();
  };
};

// Strip sensitive fields from response based on role
const filterFields = (tableName) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      const fieldsToStrip = SENSITIVE_FIELDS[tableName] || [];
      if (fieldsToStrip.length === 0) return originalJson(data);

      const strip = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const cleaned = { ...obj };
        fieldsToStrip.forEach(f => delete cleaned[f]);
        return cleaned;
      };

      if (Array.isArray(data)) {
        return originalJson(data.map(strip));
      }
      if (data && data.data && Array.isArray(data.data)) {
        return originalJson({ ...data, data: data.data.map(strip) });
      }
      return originalJson(strip(data));
    };
    next();
  };
};

module.exports = { requireRole, checkRowAccess, filterFields, ROLE_HIERARCHY };
