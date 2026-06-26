'use strict';

/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT Extraction, Verification & Role-Based Access Control (RBAC) Layer.
 *
 * Responsibilities:
 *   1. Extract the Bearer token from the Authorization header.
 *   2. Verify the signature and expiry using jsonwebtoken.
 *   3. Validate that the decoded tenant still exists and is active in the DB.
 *   4. Attach `req.user`, `req.tenant_id`, and `req.user_role` for downstream.
 *   5. Provide a factory `requireRole(...roles)` for route-level RBAC guards.
 *
 * Usage:
 *   const { authenticate, requireRole } = require('../middleware/auth');
 *   router.get('/fleet', authenticate, requireRole('FleetManager','SuperAdmin'), handler);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const jwt    = require('jsonwebtoken');
const { pool } = require('../db/pool');   // pg Pool singleton — see db/pool.js below

// ─── Constants ───────────────────────────────────────────────────────────────

const JWT_SECRET      = process.env.JWT_SECRET;
const JWT_ALGORITHM   = 'HS256';

// Roles recognized by the platform (must match user_role_enum in schema.sql)
const VALID_ROLES = new Set([
  'SuperAdmin',
  'FleetManager',
  'BookingExecutive',
  'Driver',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the raw token string from "Authorization: Bearer <token>".
 * Returns null if the header is absent or malformed.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  return parts[1];
}

/**
 * Sends a structured, machine-readable auth error response.
 *
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} code        - Short machine error code, e.g. "TOKEN_EXPIRED"
 * @param {string} message     - Human-readable detail
 */
function authError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}

// ─── Core Middleware: authenticate ───────────────────────────────────────────

/**
 * authenticate
 * ─────────────────────────────────────────────────────────────────────────────
 * Express middleware. Must be applied to every protected route.
 *
 * Flow:
 *   Token present? → verify signature → decode payload → validate tenant in DB
 *   → attach to req → next()
 *
 * Sets on req:
 *   req.user        = { user_id, email, name, role, tenant_id }
 *   req.tenant_id   = UUID string
 *   req.user_role   = role string
 *
 * @type {import('express').RequestHandler}
 */
async function authenticate(req, res, next) {
  // 1. Guard: JWT_SECRET must be set at boot time.
  if (!JWT_SECRET) {
    console.error('[AUTH] FATAL: JWT_SECRET environment variable is not set.');
    return authError(res, 500, 'SERVER_MISCONFIGURATION', 'Authentication service is not configured.');
  }

  // 2. Extract token from Authorization header.
  const token = extractBearerToken(req);
  if (!token) {
    return authError(
      res, 401, 'MISSING_TOKEN',
      'Authorization header is missing or does not contain a Bearer token.'
    );
  }

  // 3. Verify JWT signature and expiry.
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return authError(res, 401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      return authError(res, 401, 'TOKEN_INVALID', 'The provided token is invalid or has been tampered with.');
    }
    // Unexpected JWT error (e.g., algorithm mismatch)
    console.error('[AUTH] Unexpected JWT error:', err);
    return authError(res, 401, 'TOKEN_VERIFICATION_FAILED', 'Token verification failed.');
  }

  // 4. Validate payload structure — we require these three fields.
  const { user_id, tenant_id, role } = decoded;

  if (!user_id || typeof user_id !== 'string') {
    return authError(res, 401, 'TOKEN_PAYLOAD_INVALID', 'Token payload is missing user_id.');
  }
  if (!tenant_id || typeof tenant_id !== 'string') {
    return authError(res, 401, 'TOKEN_PAYLOAD_INVALID', 'Token payload is missing tenant_id.');
  }
  if (!role || !VALID_ROLES.has(role)) {
    return authError(res, 401, 'TOKEN_PAYLOAD_INVALID', `Token contains an unrecognized role: "${role}".`);
  }

  // 5. Confirm the user still exists, is active, and belongs to the stated tenant.
  //    This single DB query also defends against revoked sessions and deleted users.
  //    We SELECT from users JOIN tenants so we can also verify the tenant is active.
  let userRow;
  try {
    const result = await pool.query(
      `SELECT
         u.user_id,
         u.tenant_id,
         u.name,
         u.email,
         u.role,
         u.is_active       AS user_is_active,
         t.company_name,
         t.is_active       AS tenant_is_active,
         t.domain_subdomain
       FROM users    u
       JOIN tenants  t ON t.tenant_id = u.tenant_id
       WHERE u.user_id   = $1
         AND u.tenant_id = $2
       LIMIT 1`,
      [user_id, tenant_id]
    );

    userRow = result.rows[0];
  } catch (dbErr) {
    console.error('[AUTH] Database error during user validation:', dbErr);
    return authError(res, 500, 'AUTH_DB_ERROR', 'Authentication database check failed.');
  }

  if (!userRow) {
    return authError(
      res, 401, 'USER_NOT_FOUND',
      'The user associated with this token could not be found or does not belong to the stated tenant.'
    );
  }

  if (!userRow.user_is_active) {
    return authError(res, 403, 'USER_DISABLED', 'This user account has been disabled. Contact your administrator.');
  }

  if (!userRow.tenant_is_active) {
    return authError(res, 403, 'TENANT_SUSPENDED', 'This organization account has been suspended. Contact support.');
  }

  // 6. Verify the role in the token still matches the DB (roles can change).
  if (userRow.role !== role) {
    return authError(
      res, 403, 'ROLE_MISMATCH',
      'Your session role does not match the current assigned role. Please log in again.'
    );
  }

  // 7. All checks passed — hydrate req for downstream middleware and route handlers.
  req.user = {
    user_id:    userRow.user_id,
    tenant_id:  userRow.tenant_id,
    name:       userRow.name,
    email:      userRow.email,
    role:       userRow.role,
    company:    userRow.company_name,
    subdomain:  userRow.domain_subdomain,
  };
  req.tenant_id  = userRow.tenant_id;   // convenience shorthand used everywhere
  req.user_role  = userRow.role;        // convenience shorthand for RBAC guards

  return next();
}

// ─── RBAC Factory: requireRole ────────────────────────────────────────────────

/**
 * requireRole(...allowedRoles)
 * ─────────────────────────────────────────────────────────────────────────────
 * Factory that returns an Express middleware enforcing that the authenticated
 * user's role is one of the provided `allowedRoles`.
 *
 * MUST be used AFTER `authenticate` in the middleware chain.
 *
 * Example:
 *   router.delete('/vehicles/:id',
 *     authenticate,
 *     requireRole('FleetManager', 'SuperAdmin'),
 *     deleteVehicleHandler
 *   );
 *
 * @param {...string} allowedRoles - One or more roles from VALID_ROLES
 * @returns {import('express').RequestHandler}
 */
function requireRole(...allowedRoles) {
  // Validate at definition time so typos fail fast during server startup.
  for (const r of allowedRoles) {
    if (!VALID_ROLES.has(r)) {
      throw new Error(`[requireRole] Unknown role: "${r}". Must be one of: ${[...VALID_ROLES].join(', ')}`);
    }
  }

  const allowedSet = new Set(allowedRoles);

  return function rbacGuard(req, res, next) {
    if (!req.user_role) {
      // authenticate middleware was not run before this guard — developer error.
      return authError(
        res, 500, 'MIDDLEWARE_ORDER_ERROR',
        'requireRole must be used after the authenticate middleware.'
      );
    }

    if (!allowedSet.has(req.user_role)) {
      return authError(
        res, 403, 'INSUFFICIENT_PERMISSIONS',
        `Your role "${req.user_role}" is not authorized to perform this action. ` +
        `Required: ${allowedRoles.join(' or ')}.`
      );
    }

    return next();
  };
}

// ─── Optional: SuperAdmin bypass ─────────────────────────────────────────────

/**
 * requireRoleOrSuperAdmin(...roles)
 * Convenience wrapper that always allows SuperAdmin through,
 * in addition to the explicitly specified roles.
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
function requireRoleOrSuperAdmin(...allowedRoles) {
  return requireRole(...allowedRoles, 'SuperAdmin');
}

// ─── Token Issuer (used by /auth/login route) ─────────────────────────────────

/**
 * issueToken(user)
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a signed JWT for a successfully authenticated user.
 * Call this from your login route after verifying the password hash.
 *
 * Payload is intentionally minimal — only IDs and role.
 * PII (name, email) is NOT stored in the token.
 *
 * @param {{ user_id: string, tenant_id: string, role: string }} user
 * @param {string} [expiresIn='8h']
 * @returns {string} Signed JWT string
 */
function issueToken(user, expiresIn = '8h') {
  if (!JWT_SECRET) {
    throw new Error('[AUTH] Cannot issue token: JWT_SECRET is not set.');
  }
  return jwt.sign(
    {
      user_id:   user.user_id,
      tenant_id: user.tenant_id,
      role:      user.role,
    },
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn,
      issuer:    'universal-fleet-engine',
    }
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  authenticate,
  requireRole,
  requireRoleOrSuperAdmin,
  issueToken,
};
